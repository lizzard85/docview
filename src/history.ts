// History of recently shown contents (pasted text, clipboard, opened files).
// Pure list logic; storage is in backend.ts (history.json next to settings.json).

export interface HistoryEntry {
  /** Milliseconds since 1970. */
  time: number;
  text: string;
  /** File name, when the content came from a file. */
  name?: string;
  /** Detected language id. */
  lang: string;
  /** Short one-line preview. */
  preview: string;
}

export const MAX_ENTRIES = 30;
/** Contents larger than this are not stored. */
export const MAX_ENTRY_BYTES = 1024 * 1024;
/** The whole history is kept below this size. */
export const MAX_TOTAL_BYTES = 10 * 1024 * 1024;
const PREVIEW_CHARS = 80;

/** UTF-8 size of a string. */
export function byteSize(s: string): number {
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x80) n += 1;
    else if (c < 0x800) n += 2;
    else if (c >= 0xd800 && c <= 0xdbff) { n += 4; i++; } // surrogate pair
    else n += 3;
  }
  return n;
}

/** First non-empty line, whitespace collapsed, shortened. */
export function makePreview(text: string): string {
  const line = text.split("\n").find((l) => l.trim()) ?? "";
  const s = line.replace(/\s+/g, " ").trim();
  return s.length > PREVIEW_CHARS ? s.slice(0, PREVIEW_CHARS - 1) + "…" : s;
}

/**
 * Adds an entry at the top. An identical earlier entry (same text and name)
 * is moved to the top instead of being duplicated. Empty and oversized
 * contents are not stored. The list is capped by count and total size; the
 * oldest entries go first.
 */
export function addToHistory(
  list: HistoryEntry[],
  item: { text: string; name?: string; lang: string; time: number },
): HistoryEntry[] {
  if (!item.text.trim() || byteSize(item.text) > MAX_ENTRY_BYTES) return list;
  const entry: HistoryEntry = { time: item.time, text: item.text, lang: item.lang, preview: makePreview(item.text) };
  if (item.name) entry.name = item.name;
  const rest = list.filter((e) => !(e.text === item.text && e.name === item.name));
  return capHistory([entry, ...rest]);
}

/** Keeps at most MAX_ENTRIES entries and MAX_TOTAL_BYTES of text, newest first. */
export function capHistory(list: HistoryEntry[]): HistoryEntry[] {
  const out: HistoryEntry[] = [];
  let total = 0;
  for (const e of list) {
    if (out.length >= MAX_ENTRIES) break;
    const size = byteSize(e.text);
    if (total + size > MAX_TOTAL_BYTES) break;
    total += size;
    out.push(e);
  }
  return out;
}

/** Validates data read from disk; drops anything malformed. */
export function parseHistory(data: unknown): HistoryEntry[] {
  if (!Array.isArray(data)) return [];
  const out: HistoryEntry[] = [];
  for (const e of data) {
    if (!e || typeof e !== "object") continue;
    const r = e as Record<string, unknown>;
    if (typeof r.text !== "string" || typeof r.time !== "number") continue;
    const entry: HistoryEntry = {
      time: r.time,
      text: r.text,
      lang: typeof r.lang === "string" ? r.lang : "plaintext",
      preview: typeof r.preview === "string" ? r.preview : makePreview(r.text),
    };
    if (typeof r.name === "string" && r.name) entry.name = r.name;
    out.push(entry);
  }
  return capHistory(out.sort((a, b) => b.time - a.time));
}

/** "just now", "5 min ago", "3 h ago", "yesterday", or a date. */
export function relativeTime(time: number, now: number): string {
  const s = Math.max(0, Math.round((now - time) / 1000));
  if (s < 60) return "just now";
  const min = Math.floor(s / 60);
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return "yesterday";
  if (d < 7) return `${d} days ago`;
  return new Date(time).toLocaleDateString();
}
