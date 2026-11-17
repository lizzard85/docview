// "Save as…" helpers (pure): suggested file name, dialog filters and line endings.

import { LANG_BY_ID } from "./languages";

/** Extension for a language id (without the dot); "txt" when unknown. */
export function extensionFor(lang: string): string {
  return LANG_BY_ID.get(lang)?.ext ?? "txt";
}

/**
 * Suggested file name in the save dialog. An opened (or converted) file keeps
 * its name; pasted text becomes `snippet.<ext>` for the shown language.
 * A name without an extension gets the language's extension.
 */
export function suggestFileName(name: string | undefined, lang: string): string {
  const ext = extensionFor(lang);
  const base = name?.split(/[\\/]/).pop()?.trim();
  if (!base) return `snippet.${ext}`;
  return /\.[^.]+$/.test(base) ? base : `${base}.${ext}`;
}

/**
 * Suggested path: next to the opened file when there is one, else just the
 * file name (the dialog then starts in its default folder).
 */
export function suggestPath(path: string | undefined, name: string | undefined, lang: string): string {
  const file = suggestFileName(name, lang);
  if (!path) return file;
  const i = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return i < 0 ? file : path.slice(0, i + 1) + file;
}

export interface SaveFilter {
  name: string;
  extensions: string[];
}

/** File type filters: the shown language first, then all files. */
export function saveFilters(lang: string): SaveFilter[] {
  const info = LANG_BY_ID.get(lang);
  const all = { name: "All files", extensions: ["*"] };
  if (!info || info.id === "plaintext") return [{ name: "Text", extensions: ["txt"] }, all];
  return [{ name: info.label, extensions: [info.ext] }, all];
}

/** Normalises line endings: CRLF for Windows, LF otherwise. */
export function withLineEndings(text: string, crlf: boolean): string {
  const lf = text.replace(/\r\n?/g, "\n");
  return crlf ? lf.replace(/\n/g, "\r\n") : lf;
}
