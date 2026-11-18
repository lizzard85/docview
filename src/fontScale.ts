// Code font size scale (pure). The setting ranges 10–24px; the line height,
// gutter and tree/table sizes follow from it. UI chrome does not scale.

export const FONT_MIN = 10;
export const FONT_MAX = 24;
export const FONT_DEFAULT = 13.5;
/** Ctrl+= / Ctrl+− step. */
export const FONT_STEP = 1;

/** Clamps a (possibly stored, possibly invalid) size into the range. */
export function clampFontSize(size: unknown): number {
  const n = typeof size === "number" ? size : Number(size);
  if (!Number.isFinite(n) || n <= 0) return FONT_DEFAULT;
  return Math.min(FONT_MAX, Math.max(FONT_MIN, n));
}

/** The next size for a zoom step: 1 = larger, -1 = smaller, 0 = reset. */
export function zoomFontSize(size: number, delta: number): number {
  if (delta === 0) return FONT_DEFAULT;
  return clampFontSize(clampFontSize(size) + delta * FONT_STEP);
}

/** Code line height: round(size × 1.63), e.g. 13.5 → 22, 16 → 26. */
export function lineHeight(size: number): number {
  return Math.round(size * 1.63);
}

/** Tree and table text is the code size − 0.5px. */
export function panelFontSize(size: number): number {
  return size - 0.5;
}

/** Tree and table row height: their line height + 6px. */
export function panelRowHeight(size: number): number {
  return lineHeight(panelFontSize(size)) + 6;
}

/** Width of the line-number gutter in `ch`: digits of the last line number + 1. */
export function gutterChars(lineCount: number): number {
  return String(Math.max(1, Math.floor(lineCount))).length + 1;
}
