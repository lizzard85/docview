// SQL with separate parameter values, as captured from SQL Server Profiler /
// Extended Events (exec sp_executesql N'…', N'@p0 int', @p0=42) or logged by
// EF Core ("Executed DbCommand … [Parameters=[@p0='42'], …]" + the SQL).
// The parameters can be substituted with literals so the SQL runs in SSMS.

export type SqlParamsKind = "sp_executesql" | "efcore";

export interface SqlWithParams {
  kind: SqlParamsKind;
  /** The SQL text (for sp_executesql: unescaped from the N'…' literal). */
  sql: string;
  /** Parameter name (lower case, with @) -> SQL literal. */
  params: Map<string, string>;
}

/** Reads a '…' literal starting at `i` (the quote). Returns the content with '' unescaped and the index after it. */
function readQuoted(s: string, i: number): { value: string; end: number } | null {
  let value = "";
  for (let j = i + 1; j < s.length; j++) {
    if (s[j] === "'") {
      if (s[j + 1] === "'") { value += "'"; j++; continue; }
      return { value, end: j + 1 };
    }
    value += s[j];
  }
  return null;
}

function skipWs(s: string, i: number): number {
  while (i < s.length && /\s/.test(s[i])) i++;
  return i;
}

/** Reads one sp_executesql argument value as literal text (N'…', '…', number, NULL, 0x…, …). */
function readValue(s: string, i: number): { literal: string; end: number } | null {
  const start = i;
  if (/[Nn]/.test(s[i]) && s[i + 1] === "'") i++;
  if (s[i] === "'") {
    const q = readQuoted(s, i);
    return q ? { literal: s.slice(start, q.end), end: q.end } : null;
  }
  const m = /^[^,\s]+/.exec(s.slice(i));
  return m ? { literal: m[0], end: i + m[0].length } : null;
}

const PARAM_NAME = /^@[\w@$#]+/;

function parseSpExecuteSql(text: string): SqlWithParams | null {
  const head = /^\s*(?:exec(?:ute)?\s+)?(?:(?:\[?sys\]?|\[?dbo\]?)\.)?sp_executesql\s+/i.exec(text);
  if (!head) return null;
  let i = head[0].length;
  if (/[Nn]/.test(text[i]) && text[i + 1] === "'") i++;
  if (text[i] !== "'") return null;
  const sql = readQuoted(text, i);
  if (!sql) return null;
  i = skipWs(text, sql.end);

  const params = new Map<string, string>();
  if (i >= text.length || text[i] === ";") return { kind: "sp_executesql", sql: sql.value, params };
  if (text[i] !== ",") return null;

  // Parameter declarations: N'@p0 int,@p1 nvarchar(4000)'
  i = skipWs(text, i + 1);
  if (/[Nn]/.test(text[i]) && text[i + 1] === "'") i++;
  const decl = text[i] === "'" ? readQuoted(text, i) : null;
  if (!decl) return null;
  const declared = [...decl.value.matchAll(/(@[\w@$#]+)\s+[^,(]+(?:\([^)]*\))?(?:\s+(?:output|out))?/gi)].map((m) => m[1].toLowerCase());
  i = skipWs(text, decl.end);

  // Values: @p0=42, @p1=N'x' (or positional: 42, N'x')
  for (let n = 0; text[i] === ","; n++) {
    i = skipWs(text, i + 1);
    let name = declared[n];
    const named = PARAM_NAME.exec(text.slice(i));
    if (named) {
      const eq = skipWs(text, i + named[0].length);
      if (text[eq] !== "=") return null;
      name = named[0].toLowerCase();
      i = skipWs(text, eq + 1);
    }
    const v = readValue(text, i);
    if (!v || !name) return null;
    params.set(name, v.literal);
    i = skipWs(text, v.end);
    const out = /^(?:output|out)\b/i.exec(text.slice(i));
    if (out) i = skipWs(text, i + out[0].length);
  }
  if (i < text.length && text[i] !== ";") return null;
  return { kind: "sp_executesql", sql: sql.value, params };
}

// ------------------------------------------------------------------ EF Core

const EF_LINE = /(?:Executed|Executing|Failed executing) DbCommand[^\n]*?\[Parameters=\[/;

/** Turns an EF Core parameter value into a SQL literal, using the facets EF Core prints after it. */
export function efLiteral(value: string | null, facets: string): string {
  if (value === null) return "NULL";
  const dbType = /DbType\s*=\s*(\w+)/i.exec(facets)?.[1]?.toLowerCase();
  const quote = (s: string, unicode = true) => `${unicode ? "N" : ""}'${s.replace(/'/g, "''")}'`;
  if (dbType === "ansistring" || dbType === "ansistringfixedlength") return quote(value, false);
  if (dbType?.includes("string") || /\bSize\s*=/.test(facets)) return quote(value);
  if (/^(true|false)$/i.test(value) && (!dbType || dbType === "boolean")) return /^true$/i.test(value) ? "1" : "0";
  if (/^-?\d+(\.\d+)?(E[+-]?\d+)?$/i.test(value) && (!dbType || !/date|time|guid|binary/.test(dbType))) return value;
  // Dates, GUIDs and everything else as a quoted string.
  return quote(value, false);
}

function parseEfCore(text: string): SqlWithParams | null {
  const m = EF_LINE.exec(text);
  if (!m) return null;
  let i = m.index + m[0].length;
  const params = new Map<string, string>();
  // @name='value' (Facet = x) (Facet = y), …  — the list ends with "]".
  // Quotes inside values are not escaped by EF Core, so a value ends at a
  // quote followed by facets and then ", @" or "]".
  const item = /^\s*(@[\w@$#]+)=(?:NULL|'([\s\S]*?)')((?:\s*\([^()]*\))*)\s*(?=,\s*@|\])/;
  if (text[i] !== "]") {
    for (;;) {
      const p = item.exec(text.slice(i));
      if (!p) return null;
      if (p[2] === "?") return null; // sensitive data logging is off: values are hidden
      params.set(p[1].toLowerCase(), efLiteral(p[2] ?? null, p[3]));
      i += p[0].length;
      if (text[i] === "]") break;
      i++; // the comma
    }
  }
  // The rest of the log line (", CommandType='Text', CommandTimeout='30']"), then the SQL.
  const eol = text.indexOf("\n", i);
  if (eol < 0) return null;
  const sql = dedent(text.slice(eol + 1).replace(/^\s*\n/, "").trimEnd());
  if (!sql.trim()) return null;
  return { kind: "efcore", sql, params };
}

/** Removes the indentation all non-empty lines share (EF Core indents the logged SQL). */
function dedent(s: string): string {
  const lines = s.split("\n");
  const indent = Math.min(...lines.filter((l) => l.trim()).map((l) => /^[ \t]*/.exec(l)![0].length));
  return lines.map((l) => l.slice(indent)).join("\n");
}

// ------------------------------------------------------------------ public

/** Recognizes sp_executesql calls and EF Core command logs. Returns null for anything else. */
export function parseSqlWithParams(text: string): SqlWithParams | null {
  return parseSpExecuteSql(text) ?? parseEfCore(text);
}

/**
 * Replaces @parameters in `sql` with their literals. Strings, quoted
 * identifiers and comments are left alone, and names match whole words only
 * (@p1 never matches part of @p10).
 */
export function substituteParams(sql: string, params: Map<string, string>): string {
  let out = "";
  let i = 0;
  while (i < sql.length) {
    const c = sql[i];
    const rest = sql.slice(i);
    let skip = 0;
    if (c === "'") skip = (readQuoted(sql, i)?.end ?? sql.length) - i;
    else if (c === '"') skip = (sql.indexOf('"', i + 1) + 1 || sql.length + 1) - i;
    else if (c === "[") skip = (sql.indexOf("]", i + 1) + 1 || sql.length + 1) - i;
    else if (rest.startsWith("--")) skip = (sql.indexOf("\n", i) + 1 || sql.length + 1) - i;
    else if (rest.startsWith("/*")) skip = (sql.indexOf("*/", i + 2) + 2 || sql.length + 2) - i;
    if (skip > 0) {
      out += sql.slice(i, i + skip);
      i += skip;
      continue;
    }
    if (c === "@" && !/[\w@$#]/.test(sql[i - 1] ?? "")) {
      const name = PARAM_NAME.exec(rest)?.[0] ?? "@";
      const literal = params.get(name.toLowerCase());
      out += literal ?? name;
      i += name.length;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

/** The SQL with parameters inlined, or null if `text` has no recognizable parameters. */
export function inlineSqlParams(text: string): { sql: string; kind: SqlParamsKind } | null {
  const parsed = parseSqlWithParams(text);
  if (!parsed) return null;
  return { sql: substituteParams(parsed.sql, parsed.params), kind: parsed.kind };
}
