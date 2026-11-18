// Side-by-side comparison of two texts: line diff with inline highlighting of
// changed characters. Pure functions (no DOM).
import { diffArrays, diffChars, diffLines } from "diff";
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

export interface DiffOptions {
  /** Lines that only differ in whitespace count as the same, and whitespace is not marked in changed lines. */
  ignoreWhitespace?: boolean;
}

/** A line without any whitespace (for comparing with "Ignore whitespace"). */
export function stripWhitespace(line: string): string {
  return line.replace(/\s+/g, "");
}

/** One part of a line diff: lines on the left and/or right side. */
interface Part {
  kind: "same" | "removed" | "added";
  left: string[];
  right: string[];
}

function lineParts(leftText: string, rightText: string, opts: DiffOptions): Part[] {
  const l = leftText.replace(/\r\n?/g, "\n");
  const r = rightText.replace(/\r\n?/g, "\n");
  if (!opts.ignoreWhitespace) {
    return diffLines(l, r).map((p) => {
      const lines = splitLines(p.value);
      if (p.added) return { kind: "added", left: [], right: lines };
      if (p.removed) return { kind: "removed", left: lines, right: [] };
      return { kind: "same", left: lines, right: lines };
    });
  }
  // Line arrays compared without whitespace; each side keeps its own text.
  const a = splitLines(l);
  const b = splitLines(r);
  let i = 0;
  let j = 0;
  return diffArrays(a, b, { comparator: (x, y) => stripWhitespace(x) === stripWhitespace(y) }).map((p) => {
    const n = p.count ?? p.value.length;
    if (p.added) return { kind: "added", left: [], right: b.slice(j, (j += n)) };
    if (p.removed) return { kind: "removed", left: a.slice(i, (i += n)), right: [] };
    return { kind: "same", left: a.slice(i, (i += n)), right: b.slice(j, (j += n)) };
  });
}

/** Whitespace-only changes are not marked (for "Ignore whitespace"). */
function unmarkWhitespace(segments: Segment[]): Segment[] {
  const out: Segment[] = [];
  for (const s of segments) {
    if (!s.changed) { out.push(s); continue; }
    for (const piece of s.text.split(/(\s+)/)) {
      if (piece) out.push({ text: piece, changed: !!piece.trim() });
    }
  }
  return out;
}

/** Line diff of two texts as side-by-side rows. Removed lines followed by added lines are paired as changed lines. */
export function diffTexts(leftText: string, rightText: string, opts: DiffOptions = {}): DiffResult {
  const rows: DiffRow[] = [];
  let l = 1;
  let r = 1;
  const seg = (text: string, changed: boolean): Segment[] => [{ text, changed }];
  const parts = lineParts(leftText, rightText, opts);
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (part.kind === "same") {
      part.left.forEach((text, k) => {
        rows.push({ kind: "same", left: { line: l++, segments: seg(text, false) }, right: { line: r++, segments: seg(part.right[k] ?? text, false) } });
      });
      continue;
    }
    if (part.kind === "removed" && parts[i + 1]?.kind === "added") {
      const removed = part.left;
      const added = parts[++i].right;
      const n = Math.max(removed.length, added.length);
      for (let k = 0; k < n; k++) {
        const a = removed[k], b = added[k];
        if (a !== undefined && b !== undefined) {
          const d = inlineDiff(a, b);
          const left = opts.ignoreWhitespace ? unmarkWhitespace(d.left) : d.left;
          const right = opts.ignoreWhitespace ? unmarkWhitespace(d.right) : d.right;
          rows.push({ kind: "changed", left: { line: l++, segments: left }, right: { line: r++, segments: right } });
        } else if (a !== undefined) {
          rows.push({ kind: "removed", left: { line: l++, segments: seg(a, true) } });
        } else {
          rows.push({ kind: "added", right: { line: r++, segments: seg(b!, true) } });
        }
      }
      continue;
    }
    for (const text of part.left) rows.push({ kind: "removed", left: { line: l++, segments: seg(text, true) } });
    for (const text of part.right) rows.push({ kind: "added", right: { line: r++, segments: seg(text, true) } });
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
