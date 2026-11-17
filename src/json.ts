// Lenient JSON parsing: accepts comments, trailing commas and raw control
// characters inside strings, which JSON.parse rejects.

export function stripJsonComments(s: string): string {
  // Remove // and /* */ comments outside strings, and trailing commas.
  let out = "";
  let i = 0;
  let inStr = false;
  while (i < s.length) {
    const c = s[i];
    if (inStr) {
      out += c;
      if (c === "\\") { out += s[i + 1] ?? ""; i += 2; continue; }
      if (c === '"') inStr = false;
      i++;
    } else if (c === '"') {
      inStr = true; out += c; i++;
    } else if (c === "/" && s[i + 1] === "/") {
      while (i < s.length && s[i] !== "\n") i++;
    } else if (c === "/" && s[i + 1] === "*") {
      const end = s.indexOf("*/", i + 2);
      i = end < 0 ? s.length : end + 2;
    } else {
      out += c; i++;
    }
  }
  return out.replace(/,(\s*[}\]])/g, "$1");
}

const SHORT_ESCAPES: Record<string, string> = { "\n": "\\n", "\r": "\\r", "\t": "\\t", "\b": "\\b", "\f": "\\f" };

/**
 * Escapes raw control characters (line breaks, tabs, …) inside JSON strings.
 *
 * Special case: a line break directly followed by `uXXXX` is turned back into
 * the escape `\uXXXX`. Business Central's Message()/Error() dialogs show every
 * backslash as a line break, so JSON copied from such a dialog has `’` (`’`)
 * as "<line break>u2019".
 */
export function escapeControlCharsInStrings(s: string): string {
  let out = "";
  let inStr = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (!inStr) {
      if (c === '"') inStr = true;
      out += c;
      continue;
    }
    if (c === "\\") { out += c + (s[i + 1] ?? ""); i++; continue; }
    if (c === '"') { inStr = false; out += c; continue; }
    if (c < " ") {
      const brk = c === "\r" && s[i + 1] === "\n" ? 2 : c === "\n" || c === "\r" ? 1 : 0;
      if (brk && /^u[0-9a-fA-F]{4}/.test(s.slice(i + brk, i + brk + 5))) {
        out += "\\";
        i += brk - 1;
        continue;
      }
      out += SHORT_ESCAPES[c] ?? `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`;
      continue;
    }
    out += c;
  }
  return out;
}

export interface ParsedJson {
  value: unknown;
  /** True if raw control characters in strings had to be repaired. */
  repaired: boolean;
}

/** Parses JSON, falling back to comment/trailing-comma removal and string repair. Throws the original error. */
export function parseJsonLenient(text: string): ParsedJson {
  try {
    return { value: JSON.parse(text), repaired: false };
  } catch (first) {
    try {
      return { value: JSON.parse(stripJsonComments(text)), repaired: false };
    } catch { /* try repairing strings */ }
    const fixed = escapeControlCharsInStrings(text);
    if (fixed !== text) {
      try {
        return { value: JSON.parse(stripJsonComments(fixed)), repaired: true };
      } catch { /* report the original error */ }
    }
    throw first;
  }
}
