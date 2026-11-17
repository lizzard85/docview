// JSON that is stored inside a string ("escaped JSON"), as often found in logs
// and API responses: "{\"id\":1}" or a bare {\"id\":1}.

/** How many levels of string escaping are unwrapped at most. */
export const MAX_UNWRAP_LEVELS = 5;

/**
 * Parses `s` as embedded JSON: only when it starts with `{` or `[` after
 * trimming and parses to an object or array. Returns undefined otherwise –
 * strings are never guessed to be JSON.
 */
export function parseEmbeddedJson(s: string): object | undefined {
  const t = s.trim();
  if (t[0] !== "{" && t[0] !== "[") return undefined;
  try {
    const v: unknown = JSON.parse(t);
    return v !== null && typeof v === "object" ? v : undefined;
  } catch {
    return undefined;
  }
}

/** Removes one level of string escaping, or returns null if `t` is not an escaped string. */
function unescapeOnce(t: string): string | null {
  if (t[0] === '"') {
    try {
      const v: unknown = JSON.parse(t);
      return typeof v === "string" ? v : null;
    } catch {
      return null;
    }
  }
  // A bare escaped JSON text without the surrounding quotes: {\"id\":1}
  if ((t[0] === "{" || t[0] === "[") && t.includes('\\"')) {
    try {
      JSON.parse(t);
      return null; // already valid JSON (e.g. ["a\"b"]) – nothing to unescape
    } catch { /* fall through */ }
    try {
      const v: unknown = JSON.parse(`"${t}"`);
      return typeof v === "string" ? v : null;
    } catch {
      return null;
    }
  }
  return null;
}

export interface Unwrapped {
  /** The inner JSON text. */
  text: string;
  /** How many levels of escaping were removed (1 or more). */
  levels: number;
}

/**
 * If the whole text is JSON escaped inside a string (possibly nested), returns
 * the inner JSON text. Returns null when the text is not an escaped string or
 * the unescaped content is not a JSON object or array.
 */
export function unwrapEscapedJson(text: string): Unwrapped | null {
  let cur = text.trim();
  let levels = 0;
  while (levels < MAX_UNWRAP_LEVELS) {
    const next = unescapeOnce(cur);
    if (next === null) break;
    cur = next.trim();
    levels++;
  }
  if (levels === 0 || !parseEmbeddedJson(cur)) return null;
  return { text: cur, levels };
}
