// CSV / TSV parsing (RFC 4180), delimiter detection, sorting and filtering
// for the table view. Pure functions, no DOM.

export type Delimiter = "," | ";" | "\t";

export interface CsvData {
  delimiter: Delimiter;
  rows: string[][];
  /** 0-based line in the text where each row starts. */
  lines: number[];
  /** False when the text ended inside a quoted field. */
  complete: boolean;
}

/**
 * Parses delimited text. Fields may be quoted with `"`; inside quotes `""` is
 * a quote and delimiters and line breaks are part of the field. Rows end at
 * \n, \r\n or \r. A trailing line break does not add an empty row.
 */
export function parseCsv(text: string, delimiter: Delimiter, maxRows = Infinity): CsvData {
  const rows: string[][] = [];
  const lines: number[] = [];
  let row: string[] = [];
  let field = "";
  let line = 0;
  let rowLine = 0;
  let i = 0;
  let quoted = false;
  const n = text.length;
  const endRow = () => {
    row.push(field);
    rows.push(row);
    lines.push(rowLine);
    row = [];
    field = "";
  };
  while (i < n && rows.length < maxRows) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        quoted = false; i++; continue;
      }
      if (c === "\r" || c === "\n") {
        line++;
        if (c === "\r" && text[i + 1] === "\n") { field += "\r"; i++; }
      }
      field += text[i++];
      continue;
    }
    if (c === '"' && field === "") { quoted = true; i++; continue; }
    if (c === delimiter) { row.push(field); field = ""; i++; continue; }
    if (c === "\r" || c === "\n") {
      endRow();
      i += c === "\r" && text[i + 1] === "\n" ? 2 : 1;
      line++;
      rowLine = line;
      continue;
    }
    field += c;
    i++;
  }
  if (rows.length < maxRows && (field !== "" || row.length > 0)) endRow();
  return { delimiter, rows, lines, complete: !quoted };
}

/** How much of the text is inspected to detect the delimiter. */
const SAMPLE_CHARS = 64 * 1024;
const SAMPLE_ROWS = 200;

/** Lines ending like code (blocks, calls, statements) – text made of these is not CSV. */
const CODE_LINE_END = /(?:[{}([]|\)\s*;?|;)\s*$/;

/**
 * Finds the delimiter of CSV/TSV text, or null if the text does not look like
 * a table: at least 2 rows (3 for `,` and `;`), at least 2 fields per row, and
 * the same number of fields in every row.
 */
export function detectDelimiter(text: string): Delimiter | null {
  const sample = text.length > SAMPLE_CHARS ? text.slice(0, SAMPLE_CHARS) : text;
  const truncated = sample.length < text.length;
  for (const d of ["\t", ";", ","] as Delimiter[]) {
    if (!sample.includes(d)) continue;
    const data = parseCsv(sample, d, SAMPLE_ROWS);
    let rows = data.rows.filter((r) => !(r.length === 1 && r[0].trim() === ""));
    // The last sampled row may be cut off.
    if (truncated || data.rows.length >= SAMPLE_ROWS) rows = rows.slice(0, -1);
    if (!data.complete && !truncated) continue;
    const min = d === "\t" ? 2 : 3;
    if (rows.length < min) continue;
    const count = rows[0].length;
    if (count < 2 || rows.some((r) => r.length !== count)) continue;
    if (d !== "\t") {
      // Code and prose are not tables.
      const textLines = sample.split(/\r?\n/).filter((l) => l.trim());
      const codeLike = textLines.filter((l) => CODE_LINE_END.test(l.replace(d === ";" ? /;\s*$/ : /$^/, ""))).length;
      if (codeLike * 2 >= textLines.length) continue;
      if (rows.every((r) => r[r.length - 1].trim() === "")) continue; // every line ends with the delimiter
      if (rows.every((r) => r.slice(1).every((f) => f.startsWith(" ")))) continue; // "word, word" prose
    }
    return d;
  }
  return null;
}

/**
 * Delimiter for text already known to be a table (e.g. a .csv file):
 * the detected one, otherwise the most frequent of tab, `;` and `,` on the
 * first line (comma when there is none).
 */
export function guessDelimiter(text: string): Delimiter {
  const detected = detectDelimiter(text);
  if (detected) return detected;
  const first = text.split(/\r?\n/, 1)[0];
  let best: Delimiter = ",";
  let bestCount = 0;
  for (const d of [",", ";", "\t"] as Delimiter[]) {
    const n = first.split(d).length - 1;
    if (n > bestCount) { best = d; bestCount = n; }
  }
  return best;
}

// ------------------------------------------------------------------ table logic

/**
 * Parses a number as written in a CSV cell; NaN otherwise. Accepts `1234.5`,
 * `1,5` (decimal comma), `1.234,5` / `1,234.5` (thousands separators), `-3`,
 * `1e3`. With only one kind of separator, a single one is the decimal
 * separator and several are thousands separators.
 */
export function cellNumber(s: string): number {
  let t = s.trim().replace(/[ \u00a0']/g, "");
  const dot = t.lastIndexOf("."), comma = t.lastIndexOf(",");
  if (dot >= 0 && comma >= 0) {
    const decimal = dot > comma ? "." : ",";
    t = t.split(decimal === "." ? "," : ".").join("").replace(",", ".");
  } else if (comma >= 0 || dot >= 0) {
    const sep = comma >= 0 ? "," : ".";
    const parts = t.split(sep);
    if (parts.length === 2) t = parts.join(".");
    // Several separators: thousands groups (1,234,567), not e.g. a version (1.2.3).
    else if (parts.slice(1).every((p) => p.length === 3) && /^[-+]?\d{1,3}$/.test(parts[0])) t = parts.join("");
    else return NaN;
  }
  return /^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(t) ? Number(t) : NaN;
}

/** A column is numeric when every non-empty cell is a number (and there is at least one). */
export function isNumericColumn(rows: string[][], col: number): boolean {
  let any = false;
  for (const r of rows) {
    const v = r[col] ?? "";
    if (!v.trim()) continue;
    if (Number.isNaN(cellNumber(v))) return false;
    any = true;
  }
  return any;
}

export type SortDir = "asc" | "desc";

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

/**
 * Indices of `rows` sorted by column `col` (stable). Numeric columns sort by
 * value; others alphabetically with numbers inside text in natural order.
 * Empty cells always go last.
 */
export function sortRows(rows: string[][], col: number, dir: SortDir): number[] {
  const numeric = isNumericColumn(rows, col);
  const sign = dir === "asc" ? 1 : -1;
  const idx = rows.map((_, i) => i);
  const key = rows.map((r) => r[col] ?? "");
  const nums = numeric ? key.map(cellNumber) : [];
  return idx.sort((a, b) => {
    const ea = !key[a].trim(), eb = !key[b].trim();
    if (ea || eb) return ea === eb ? a - b : ea ? 1 : -1;
    const c = numeric ? nums[a] - nums[b] : collator.compare(key[a], key[b]);
    return c !== 0 ? c * sign : a - b;
  });
}

/** Indices (from `order`) of rows with a cell containing `query` (case-insensitive). */
export function filterRows(rows: string[][], order: number[], query: string): number[] {
  const q = query.trim().toLowerCase();
  if (!q) return order;
  return order.filter((i) => rows[i].some((c) => c.toLowerCase().includes(q)));
}
