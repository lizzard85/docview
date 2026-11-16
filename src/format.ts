// Pretty-printing per language. Everything runs locally in the UI.

import { format as formatSql, type SqlLanguage, type KeywordCase } from "sql-formatter";
import xmlFormat from "xml-formatter";
import { stripJsonComments } from "./detect";

export interface FormatOptions {
  indent: number;
  printWidth: number;
  sqlDialect: SqlLanguage;
  sqlKeywordCase: KeywordCase;
}

export const DEFAULT_FORMAT_OPTIONS: FormatOptions = {
  indent: 2,
  printWidth: 100,
  sqlDialect: "transactsql",
  sqlKeywordCase: "preserve",
};

export interface FormatResult {
  text: string;
  formatted: boolean;
  error?: string;
}

/** Removes indentation common to all lines (pasted code is often indented). */
export function dedent(text: string): string {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  while (lines.length && !lines[0].trim()) lines.shift();
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  const indents = lines.filter((l) => l.trim()).map((l) => l.match(/^[ \t]*/)![0].length);
  const min = indents.length ? Math.min(...indents) : 0;
  return lines.map((l) => l.slice(min).replace(/[ \t]+$/, "")).join("\n");
}

const PRETTIER_PARSERS: Record<string, string> = {
  html: "html",
  css: "css",
  scss: "scss",
  less: "less",
  javascript: "babel",
  typescript: "typescript",
  yaml: "yaml",
  markdown: "markdown",
  graphql: "graphql",
};

export const FORMATTABLE = new Set(["json", "sql", "xml", ...Object.keys(PRETTIER_PARSERS)]);

export async function formatCode(
  text: string,
  lang: string,
  opts: FormatOptions = DEFAULT_FORMAT_OPTIONS,
): Promise<FormatResult> {
  const src = dedent(text);
  try {
    switch (lang) {
      case "json":
        return { text: formatJson(src, opts), formatted: true };
      case "sql":
        return {
          text: formatSql(src, {
            language: opts.sqlDialect,
            keywordCase: opts.sqlKeywordCase,
            tabWidth: opts.indent,
          }),
          formatted: true,
        };
      case "xml":
        return { text: formatXml(src, opts), formatted: true };
      default:
        if (PRETTIER_PARSERS[lang]) {
          return { text: await formatWithPrettier(src, PRETTIER_PARSERS[lang], opts), formatted: true };
        }
        return { text: src, formatted: false };
    }
  } catch (e) {
    return { text: src, formatted: false, error: errorMessage(e) };
  }
}

function errorMessage(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  return msg.split("\n")[0].slice(0, 200);
}

function formatJson(src: string, opts: FormatOptions): string {
  let value: unknown;
  try {
    value = JSON.parse(src);
  } catch {
    // JSON with comments / trailing commas: comments are dropped in the view.
    value = JSON.parse(stripJsonComments(src));
  }
  return JSON.stringify(value, null, opts.indent);
}

function formatXml(src: string, opts: FormatOptions): string {
  const xmlOpts = {
    indentation: " ".repeat(opts.indent),
    collapseContent: true,
    lineSeparator: "\n",
    whiteSpaceAtEndOfSelfclosingTag: true,
  };
  try {
    return xmlFormat(src, xmlOpts);
  } catch {
    // Fragment with several roots or leading text: wrap, format, unwrap.
    const wrapped = xmlFormat(`<__docview>${src}</__docview>`, xmlOpts);
    const lines = wrapped.split("\n");
    return lines
      .slice(1, -1)
      .map((l) => l.slice(opts.indent))
      .join("\n");
  }
}

// Prettier and its plugins are large, so they are loaded on first use.
async function formatWithPrettier(src: string, parser: string, opts: FormatOptions): Promise<string> {
  const [prettier, ...plugins] = await Promise.all([
    import("prettier/standalone"),
    ...pluginsFor(parser),
  ]);
  const out = await prettier.format(src, {
    parser,
    plugins: plugins.map((p) => (p as { default?: unknown }).default ?? p) as never,
    printWidth: opts.printWidth,
    tabWidth: opts.indent,
    htmlWhitespaceSensitivity: "ignore",
    proseWrap: "preserve",
  });
  return out.replace(/\n$/, "");
}

function pluginsFor(parser: string): Promise<unknown>[] {
  switch (parser) {
    case "html":
      return [
        import("prettier/plugins/html"),
        import("prettier/plugins/postcss"),
        import("prettier/plugins/babel"),
        import("prettier/plugins/estree"),
      ];
    case "css":
    case "scss":
    case "less":
      return [import("prettier/plugins/postcss")];
    case "babel":
      return [import("prettier/plugins/babel"), import("prettier/plugins/estree")];
    case "typescript":
      return [import("prettier/plugins/typescript"), import("prettier/plugins/estree")];
    case "yaml":
      return [import("prettier/plugins/yaml")];
    case "markdown":
      return [import("prettier/plugins/markdown")];
    case "graphql":
      return [import("prettier/plugins/graphql")];
    default:
      return [];
  }
}
