// Turns code into highlighted, line-numbered HTML.
import hljs from "./hljs";
import { LANG_BY_ID } from "./languages";

/** Above this size highlighting is skipped to keep the UI responsive. */
export const MAX_HIGHLIGHT_CHARS = 1_000_000;

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

export function highlight(text: string, lang: string): string {
  const grammar = LANG_BY_ID.get(lang)?.hljs ?? "plaintext";
  if (grammar === "plaintext" || text.length > MAX_HIGHLIGHT_CHARS) return escapeHtml(text);
  try {
    return hljs.highlight(text, { language: grammar, ignoreIllegals: true }).value;
  } catch {
    return escapeHtml(text);
  }
}

/**
 * Splits highlighted HTML into lines. Token spans can cross line breaks
 * (block comments, multi-line strings), so open spans are closed at the end
 * of each line and reopened on the next.
 */
export function splitHtmlLines(html: string): string[] {
  const lines: string[] = [];
  const open: string[] = [];
  let current = "";
  const re = /(<span[^>]*>)|(<\/span>)|(\n)|([^<\n]+|<)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    if (m[1]) { open.push(m[1]); current += m[1]; }
    else if (m[2]) { open.pop(); current += m[2]; }
    else if (m[3]) {
      lines.push(current + "</span>".repeat(open.length));
      current = open.join("");
    } else current += m[4];
  }
  lines.push(current + "</span>".repeat(open.length));
  return lines;
}

export function renderCode(text: string, lang: string): string {
  const lines = splitHtmlLines(highlight(text, lang));
  let out = "";
  for (let i = 0; i < lines.length; i++) {
    out += `<div class="line"><span class="ln">${i + 1}</span><span class="lc">${lines[i] || " "}</span></div>`;
  }
  return out;
}
