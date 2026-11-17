// Side-by-side comparison of two texts: line diff with inline highlighting of
// changed characters. Pure functions (no DOM).
import { diffChars, diffLines } from "diff";
import { formatCode, type FormatOptions } from "./format";
import { parseJsonLenient } from "./json";

export interface Segment {
  text: string;
  /** Part of the line that differs from the other side. */
  changed: boolean;
}

export interface Side {
  /** 1-based line number on this side. */
  line: number;
  segments: Segment[];
}

export type RowKind = "same" | "changed" | "added" | "removed";

/** One row of the side-by-side view; a missing side is an empty filler line. */
export interface DiffRow {
  kind: RowKind;
  left?: Side;
  right?: Side;
}

export interface DiffResult {
  rows: DiffRow[];
  /** Index of the first row of every change (a run of non-"same" rows). */
  changes: number[];
}

/** Lines longer than this are not diffed character by character. */
const MAX_INLINE_CHARS = 2000;

function splitLines(text: string): string[] {
  const lines = text.split("\n");
  if (lines.length > 1 && lines[lines.length - 1] === "") lines.pop();
  return lines;
}

/** Character diff of two lines as segments for each side. */
export function inlineDiff(a: string, b: string): { left: Segment[]; right: Segment[] } {
  if (a.length + b.length > MAX_INLINE_CHARS) {
    return { left: [{ text: a, changed: true }], right: [{ text: b, changed: true }] };
  }
  const left: Segment[] = [];
  const right: Segment[] = [];
  for (const part of diffChars(a, b)) {
    if (part.added) right.push({ text: part.value, changed: true });
    else if (part.removed) left.push({ text: part.value, changed: true });
    else {
      left.push({ text: part.value, changed: false });
      right.push({ text: part.value, changed: false });
    }
  }
  return { left, right };
}

/** Line diff of two texts as side-by-side rows. Removed lines followed by added lines are paired as changed lines. */
export function diffTexts(leftText: string, rightText: string): DiffResult {
  const rows: DiffRow[] = [];
  let l = 1;
  let r = 1;
  const parts = diffLines(leftText.replace(/\r\n?/g, "\n"), rightText.replace(/\r\n?/g, "\n"));
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const lines = splitLines(part.value);
    if (!part.added && !part.removed) {
      for (const text of lines) {
        rows.push({ kind: "same", left: { line: l++, segments: [{ text, changed: false }] }, right: { line: r++, segments: [{ text, changed: false }] } });
      }
      continue;
    }
    if (part.removed && parts[i + 1]?.added) {
      const added = splitLines(parts[++i].value);
      const n = Math.max(lines.length, added.length);
      for (let k = 0; k < n; k++) {
        const a = lines[k], b = added[k];
        if (a !== undefined && b !== undefined) {
          const d = inlineDiff(a, b);
          rows.push({ kind: "changed", left: { line: l++, segments: d.left }, right: { line: r++, segments: d.right } });
        } else if (a !== undefined) {
          rows.push({ kind: "removed", left: { line: l++, segments: [{ text: a, changed: true }] } });
        } else {
          rows.push({ kind: "added", right: { line: r++, segments: [{ text: b!, changed: true }] } });
        }
      }
      continue;
    }
    for (const text of lines) {
      if (part.removed) rows.push({ kind: "removed", left: { line: l++, segments: [{ text, changed: true }] } });
      else rows.push({ kind: "added", right: { line: r++, segments: [{ text, changed: true }] } });
    }
  }
  const changes: number[] = [];
  rows.forEach((row, i) => {
    if (row.kind !== "same" && (i === 0 || rows[i - 1].kind === "same")) changes.push(i);
  });
  return { rows, changes };
}

/** Sorts object keys recursively, so key order does not count as a difference. */
export function sortKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v === null || typeof v !== "object") return v;
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(v as object).sort()) out[k] = sortKeys((v as Record<string, unknown>)[k]);
  return out;
}

/**
 * Prepares a text for comparison: formatted with the current settings, JSON
 * additionally with sorted keys. Text that cannot be formatted is compared as is.
 */
export async function normalizeForCompare(text: string, lang: string, opts: FormatOptions): Promise<string> {
  if (lang === "json") {
    try {
      return JSON.stringify(sortKeys(parseJsonLenient(text).value), null, opts.indent);
    } catch { /* not valid JSON: fall through */ }
  }
  const r = await formatCode(text, lang, opts);
  return r.text;
}

/** Row index of the next/previous change after/before row `current` (wraps around). */
export function stepChange(changes: number[], current: number, dir: 1 | -1): number | undefined {
  if (!changes.length) return undefined;
  if (dir === 1) return changes.find((c) => c > current) ?? changes[0];
  for (let i = changes.length - 1; i >= 0; i--) if (changes[i] < current) return changes[i];
  return changes[changes.length - 1];
}
