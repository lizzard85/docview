// Shortcut strings are stored in the Tauri global-shortcut format ("Super+Alt+V").
// On Windows the Super key is shown as "Win", which is what users call it there.

export const isWindows = typeof navigator !== "undefined" && navigator.userAgent.includes("Windows");

/** Stored format -> what the user sees (also usable on messages that contain a shortcut). */
export function displayShortcut(s: string, windows = isWindows): string {
  return windows ? s.replace(/\bSuper\b/gi, "Win") : s;
}

/** What the user typed -> stored format. Accepts Win/Windows/Super/Meta for the Windows key. */
export function storeShortcut(s: string): string {
  return s
    .split("+")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => (/^(win|windows|super|meta)$/i.test(part) ? "Super" : part))
    .join("+");
}
