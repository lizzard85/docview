// Language detection for pasted snippets and files.
//
// Snippets are often small fragments (a single <td>, one SELECT, a JSON array),
// so detection never relies on prologues like <!DOCTYPE> or <?xml>. Each
// candidate gets a score from patterns in the text, and the strongest
// candidates are confirmed with a real parser where one is available.

import { XMLValidator } from "fast-xml-parser";
import { format as formatSql } from "sql-formatter";
import hljs from "./hljs";
import { languageFromFilename } from "./languages";
import { parseJsonLenient } from "./json";

export interface Detection {
  lang: string;
  /** "file" = from file extension, "parsed" = confirmed by a parser, "guess" = heuristics only. */
  source: "file" | "parsed" | "guess";
}

export function detectLanguage(text: string, filename?: string): Detection {
  if (filename) {
    const byExt = languageFromFilename(filename);
    if (byExt && byExt !== "plaintext") return { lang: byExt, source: "file" };
  }
  const t = text.trim();
  if (!t) return { lang: "plaintext", source: "guess" };

  const json = detectJson(t);
  if (json) return json;

  if (t.startsWith("<?php")) return { lang: "php", source: "guess" };
  if (t.startsWith("<")) {
    const markup = detectMarkup(t);
    if (markup) return markup;
  }

  return detectByScore(t);
}

// ---------------------------------------------------------------- JSON

export { stripJsonComments } from "./json";

function detectJson(t: string): Detection | null {
  const first = t[0];
  if (first !== "{" && first !== "[") return null;
  try {
    parseJsonLenient(t);
    return { lang: "json", source: "parsed" };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- HTML / XML

const HTML_TAGS = new Set(
  ("a abbr address area article aside audio b base bdi bdo blockquote body br button canvas " +
    "caption cite code col colgroup data datalist dd del details dfn dialog div dl dt em embed " +
    "fieldset figcaption figure footer form h1 h2 h3 h4 h5 h6 head header hgroup hr html i iframe " +
    "img input ins kbd label legend li link main map mark menu meta meter nav noscript object ol " +
    "optgroup option output p param picture pre progress q rp rt ruby s samp script section " +
    "select slot small source span strong style sub summary sup table tbody td template textarea " +
    "tfoot th thead time title tr track u ul var video wbr svg path center font").split(" "),
);
const VOID_TAGS = /<(br|hr|img|input|meta|link|area|base|col|embed|source|track|wbr)\b[^>]*?(?<!\/)>/i;
const HTML_ATTRS = /\s(class|style|href|src|onclick|onload|onchange|id|alt|type|name|for|rel|target|data-[\w-]+|aria-[\w-]+)\s*=/i;

export function isWellFormedXml(t: string): boolean {
  // Fragments may have several root elements or leading text; wrap them.
  const body = t.replace(/^<\?xml[^>]*\?>/, "").replace(/<!DOCTYPE[^>[]*(\[[\s\S]*?\])?\s*>/i, "");
  return XMLValidator.validate(`<__r>${body}</__r>`) === true;
}

function detectMarkup(t: string): Detection | null {
  if (/^<!doctype\s+html/i.test(t)) return { lang: "html", source: "parsed" };
  if (/^<\?xml\b/.test(t)) return { lang: "xml", source: "parsed" };

  const tagNames = [...t.matchAll(/<\/?([A-Za-z][\w:.-]*)/g)].map((m) => m[1]);
  if (tagNames.length === 0) return null; // e.g. "<= 5" or a generic type
  const unique = [...new Set(tagNames)];

  let html = 0;
  let xml = 0;
  const htmlNamed = unique.filter((n) => n === n.toLowerCase() && HTML_TAGS.has(n)).length;
  html += (htmlNamed / unique.length) * 4;
  // HTML written in caps (<TABLE>, <TD>) in legacy code.
  if (unique.every((n) => n === n.toUpperCase() && HTML_TAGS.has(n.toLowerCase()))) html += 3;
  if (HTML_ATTRS.test(t)) html += 1.5;
  if (VOID_TAGS.test(t)) html += 3;
  if (/&(nbsp|copy|amp|lt|gt|quot|middot|hellip|mdash|ndash);/.test(t)) html += 0.5;
  if (/<(script|style)\b/i.test(t)) html += 2;
  if (/\{\{|@\w+\(|v-(if|for|bind)|\*ngIf|\[\(ngModel\)\]/.test(t)) html += 0.5;

  if (/\sxmlns(:\w+)?=/.test(t)) xml += 3;
  if (unique.some((n) => n.includes(":"))) xml += 2;
  if (unique.some((n) => /^[A-Z]/.test(n) && !HTML_TAGS.has(n.toLowerCase()))) xml += 2;
  if (/<!\[CDATA\[/.test(t)) xml += 2;
  xml += ((unique.length - htmlNamed) / unique.length) * 2;

  const wellFormed = isWellFormedXml(t);
  if (html > xml) return { lang: "html", source: "parsed" };
  if (wellFormed) return { lang: "xml", source: "parsed" };
  // Not well-formed XML and not clearly HTML: HTML is the forgiving choice.
  return { lang: html > 0 ? "html" : "xml", source: "guess" };
}

// ---------------------------------------------------------------- Scored languages

type Rule = [RegExp, number];

const RULES: Record<string, Rule[]> = {
  sql: [
    [/\bselect\b[\s\S]+?\bfrom\b/i, 4],
    [/^\s*select\s+(top\s+\d+\s+)?(distinct\s+)?[\w*@\[\]"`.]/i, 2],
    [/\binsert\s+into\b/i, 5],
    [/\bupdate\s+[\w.\[\]"`]+\s+set\b/i, 5],
    [/\bdelete\s+from\b/i, 5],
    [/\b(create|alter)\s+(or\s+replace\s+)?(table|view|proc|procedure|function|index|unique\s+index|trigger|schema|database)\b/i, 5],
    [/\bdrop\s+(table|view|procedure|function|index)\b/i, 4],
    [/\btruncate\s+table\b/i, 4],
    [/\bmerge\s+into\b/i, 4],
    [/\bwhere\b/i, 1],
    [/\b(inner|left|right|full|cross)?\s*(outer\s+)?join\b[\s\S]+?\bon\b/i, 2],
    [/\b(group|order)\s+by\b/i, 2],
    [/\bdeclare\s+@\w+/i, 5],
    [/^\s*go\s*$/im, 3],
    [/\b(exec|execute)\s+[\w.\[\]]+/i, 1],
    [/^\s*with\s+\w+\s*(\([^)]*\))?\s+as\s*\(/i, 4],
    [/\bvalues\s*\(/i, 1],
    [/\b(varchar|nvarchar|int|bigint|datetime2?|decimal|numeric|bit|uniqueidentifier)\b(\s*\(\d+)?/i, 1],
    [/--[^\n]*$/m, 0.5],
    [/\bbegin\s+(tran|transaction)\b|\bcommit\b|\brollback\b/i, 2],
    [/\b(is\s+not\s+null|is\s+null|between\s+\S+\s+and)\b/i, 1],
  ],
  css: [
    [/^[ \t]*[.#]?[\w-]+(\s*[,>+~ ]\s*[.#]?[\w-:()]+)*\s*\{[^{}]*\}/m, 2],
    [/^\s*[\w-]+\s*:\s*[^;{}]+;\s*$/m, 1],
    [/@media\b|@import\b|@font-face\b|@keyframes\b/, 3],
    [/\b(color|margin|padding|display|font-size|background(-color)?|border|width|height)\s*:/, 2],
    [/\b\d+(px|em|rem|vh|vw|%)\b/, 1],
    [/#[0-9a-f]{3,6}\b/i, 0.5],
  ],
  scss: [
    [/\$[\w-]+\s*:/, 2],
    [/@(mixin|include|extend|use)\b/, 3],
    [/&[:.\-_]/, 2],
  ],
  javascript: [
    [/\b(const|let|var)\s+\w+\s*=/, 2],
    [/\bfunction\s*\w*\s*\(/, 2],
    [/=>/, 1],
    [/\bconsole\.\w+\(/, 3],
    [/\b(document|window)\.\w+/, 3],
    [/\brequire\(['"]|\bimport\s+.+\s+from\s+['"]|\bexport\s+(default|const|function)/, 3],
    [/===|!==/, 2],
    [/\b(async|await)\b/, 1],
    [/;\s*$/m, 0.5],
  ],
  typescript: [
    [/\binterface\s+\w+\s*\{/, 3],
    [/\btype\s+\w+\s*=/, 3],
    [/:\s*(string|number|boolean|any|void|unknown)\b/, 3],
    [/\b(public|private|readonly)\s+\w+\s*:/, 2],
    [/<\w+>\s*\(/, 1],
  ],
  yaml: [
    [/^\s*[\w"'.-][\w"' .-]*:\s+\S/m, 1],
    [/^\s*[\w"'.-][\w"' .-]*:\s*$/m, 1],
    [/^\s*-\s+[\w"'][^\n]*$/m, 1],
    [/^---\s*$/m, 2],
    [/^\s*\w[\w-]*:\s*[|>][-+]?\s*$/m, 2],
  ],
  markdown: [
    [/^#{1,6}\s+\S/m, 2],
    [/^\s*[-*+]\s+\S/m, 0.5],
    [/^```/m, 3],
    [/\[[^\]]+\]\([^)]+\)/, 2],
    [/\*\*[^*]+\*\*|__[^_]+__/, 1],
    [/^\s*>\s+\S/m, 1],
    [/^\|.*\|\s*$/m, 1],
  ],
  csharp: [
    [/^\s*using\s+[\w.]+\s*;/m, 4],
    [/\bnamespace\s+[\w.]+/, 3],
    [/\b(public|private|protected|internal)\s+(static\s+)?(async\s+)?(class|record|struct|interface|void|string|int|bool|Task)\b/, 3],
    [/\bvar\s+\w+\s*=\s*new\b/, 2],
    [/\{\s*get;\s*(set;|init;)?\s*\}/, 4],
    [/\bConsole\.Write(Line)?\(/, 4],
    [/\$"[^"]*\{/, 1],
    [/\bstring\[\]|\bList<\w+>/, 2],
  ],
  java: [
    [/\bpublic\s+static\s+void\s+main\s*\(/, 5],
    [/\bSystem\.out\.print/, 5],
    [/^\s*import\s+java\./m, 5],
    [/^\s*package\s+[\w.]+;/m, 4],
    [/@Override\b/, 3],
  ],
  python: [
    [/^\s*def\s+\w+\s*\(.*\)\s*(->\s*[\w\[\], ]+)?:\s*$/m, 4],
    [/^\s*(from\s+[\w.]+\s+)?import\s+[\w., ]+$/m, 1],
    [/^\s*class\s+\w+(\(.*\))?:\s*$/m, 4],
    [/\bprint\(/, 1],
    [/^\s*(if|elif|for|while|with|try|except)\b.*:\s*$/m, 2],
    [/\bself\.\w+/, 2],
    [/\bNone\b|\bTrue\b|\bFalse\b/, 1],
    [/^\s*#[^!\n]/m, 0.5],
  ],
  powershell: [
    [/\$\w+\s*=/, 1],
    [/\b(Get|Set|New|Remove|Write|Invoke|Import|Start|Stop|Test)-[A-Z]\w+/, 4],
    [/\s-(eq|ne|gt|lt|ge|le|like|match|and|or)\s/, 3],
    [/\$_\b|\$PSScriptRoot|\$env:/, 3],
    [/\|\s*(Where|Select|ForEach)-Object/, 4],
    [/\[(string|int|switch|bool)\]\$/, 3],
  ],
  bash: [
    [/^#!\/(usr\/)?bin\/(env\s+)?(ba|z)?sh/m, 6],
    [/^\s*(if|while)\s+\[\[?\s/m, 3],
    [/^\s*(fi|done|esac)\s*$/m, 3],
    [/\becho\s+["$]/, 2],
    [/\$\(\s*\w+|\$\{\w+\}/, 2],
    [/^\s*(sudo|apt|apt-get|npm|cd|ls|grep|export|chmod|curl|git|docker)\s+/m, 2],
    [/&&|\|\|/, 0.5],
  ],
  ini: [
    [/^\s*\[[\w .-]+\]\s*$/m, 3],
    [/^\s*[\w.-]+\s*=\s*.*$/m, 1],
    [/^\s*;[^\n]*$/m, 0.5],
  ],
  graphql: [
    [/^\s*(query|mutation|subscription|fragment)\s+\w+[\s({]/m, 5],
    [/^\s*type\s+\w+\s*\{/m, 2],
  ],
  dockerfile: [
    [/^\s*FROM\s+[\w./:-]+(\s+AS\s+\w+)?\s*$/m, 4],
    [/^\s*(RUN|COPY|WORKDIR|ENTRYPOINT|CMD|EXPOSE|ENV)\s+/m, 2],
  ],
  diff: [
    [/^(---|\+\+\+) \S/m, 3],
    [/^@@ -\d+(,\d+)? \+\d+(,\d+)? @@/m, 5],
  ],
};

// Languages that inherit from another one's rules.
const INHERITS: Record<string, string> = { typescript: "javascript", scss: "css" };

function score(lang: string, t: string): number {
  let s = 0;
  for (const [re, w] of RULES[lang]) if (re.test(t)) s += w;
  const parent = INHERITS[lang];
  if (parent) {
    // Only counts if the language-specific rules found something.
    if (s > 0) s += score(parent, t);
  }
  return s;
}

function lineFraction(t: string, re: RegExp): number {
  const lines = t.split(/\r?\n/).filter((l) => l.trim() && !/^\s*#/.test(l));
  if (lines.length === 0) return 0;
  return lines.filter((l) => re.test(l)).length / lines.length;
}

export function isValidSql(t: string): boolean {
  try {
    formatSql(t, { language: "transactsql" });
    return true;
  } catch {
    try {
      formatSql(t, { language: "sql" });
      return true;
    } catch {
      return false;
    }
  }
}

function detectByScore(t: string): Detection {
  const scores: Record<string, number> = {};
  for (const lang of Object.keys(RULES)) scores[lang] = score(lang, t);

  // Structure-based adjustments.
  const yamlLines = lineFraction(t, /^\s*(-\s+.*|[\w"'.-][\w"' .-]*:(\s.*)?)$/);
  if (yamlLines >= 0.8 && !/[;{}]\s*$/m.test(t)) scores.yaml += 3 + yamlLines * 2;
  else scores.yaml = Math.min(scores.yaml, 1);

  const iniLines = lineFraction(t, /^\s*(\[[^\]]+\]|[\w.-]+\s*=.*|;.*)$/);
  if (iniLines < 0.8) scores.ini = 0;

  const cssBlocks = t.match(/[^{};]+\{[^{}]*:[^{}]*\}/g)?.length ?? 0;
  if (cssBlocks === 0 && !/^\s*[\w-]+\s*:\s*[^;]+;/.test(t)) {
    scores.css = 0;
    scores.scss = 0;
  }
  // `function`, `=>`, `if (` make "CSS" very unlikely.
  if (/\bfunction\b|=>|\bif\s*\(|\breturn\b/.test(t)) { scores.css = 0; scores.scss = 0; }

  // Python's `from x import y` and C# LINQ `from x in y select` are not SQL.
  if (/^\s*from\s+[\w.]+\s+import\b/m.test(t)) scores.sql = 0;
  if (/\bfrom\s+\w+\s+in\s+\w+/.test(t)) scores.sql -= 4;

  let best = "plaintext";
  let bestScore = 0;
  for (const [lang, s] of Object.entries(scores)) {
    if (s > bestScore) { best = lang; bestScore = s; }
  }

  // SQL candidates must parse.
  if (best === "sql" || scores.sql >= 4) {
    if (scores.sql >= 4 && scores.sql >= bestScore - 1 && isValidSql(t)) {
      return { lang: "sql", source: "parsed" };
    }
    if (best === "sql") {
      delete scores.sql;
      best = "plaintext"; bestScore = 0;
      for (const [lang, s] of Object.entries(scores)) if (s > bestScore) { best = lang; bestScore = s; }
    }
  }

  if (bestScore >= 3) return { lang: best, source: "guess" };

  // Weak signals: let highlight.js' relevance scoring break the tie.
  const auto = hljs.highlightAuto(t, [
    "javascript", "typescript", "csharp", "java", "python", "powershell", "bash",
    "css", "yaml", "markdown", "ini",
  ]);
  if (auto.language && auto.relevance >= 5) return { lang: auto.language, source: "guess" };
  if (bestScore >= 2) return { lang: best, source: "guess" };
  return { lang: "plaintext", source: "guess" };
}
