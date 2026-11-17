// Tab list logic (pure). Each tab carries the view state of one document;
// main.ts saves and restores it when switching tabs.

export interface Tab<T> {
  id: number;
  data: T;
}

export interface Tabs<T> {
  tabs: Tab<T>[];
  /** Id of the active tab. */
  active: number;
  /** Next free id. */
  nextId: number;
}

export function createTabs<T>(first: T): Tabs<T> {
  return { tabs: [{ id: 1, data: first }], active: 1, nextId: 2 };
}

export function activeTab<T>(t: Tabs<T>): Tab<T> {
  return t.tabs.find((x) => x.id === t.active) ?? t.tabs[0];
}

/** Adds a tab right after the active one and activates it. */
export function addTab<T>(t: Tabs<T>, data: T): Tabs<T> {
  const id = t.nextId;
  const i = t.tabs.findIndex((x) => x.id === t.active);
  const tabs = [...t.tabs];
  tabs.splice(i < 0 ? tabs.length : i + 1, 0, { id, data });
  return { tabs, active: id, nextId: id + 1 };
}

/** Replaces the data of a tab. */
export function updateTab<T>(t: Tabs<T>, id: number, data: T): Tabs<T> {
  return { ...t, tabs: t.tabs.map((x) => (x.id === id ? { id, data } : x)) };
}

export function activate<T>(t: Tabs<T>, id: number): Tabs<T> {
  return t.tabs.some((x) => x.id === id) ? { ...t, active: id } : t;
}

/**
 * Closes a tab. Closing the active tab activates its right neighbour (or the
 * left one if it was the last). The last tab is never removed: `empty`
 * replaces its data instead.
 */
export function closeTab<T>(t: Tabs<T>, id: number, empty: T): Tabs<T> {
  const i = t.tabs.findIndex((x) => x.id === id);
  if (i < 0) return t;
  if (t.tabs.length === 1) return { ...t, tabs: [{ id, data: empty }] };
  const tabs = t.tabs.filter((x) => x.id !== id);
  const active = t.active === id ? tabs[Math.min(i, tabs.length - 1)].id : t.active;
  return { ...t, tabs, active };
}

/** Activates the next (1) or previous (-1) tab, wrapping around. */
export function cycle<T>(t: Tabs<T>, dir: 1 | -1): Tabs<T> {
  const i = t.tabs.findIndex((x) => x.id === t.active);
  const n = t.tabs.length;
  return { ...t, active: t.tabs[(i + dir + n) % n].id };
}

const TITLE_CHARS = 24;

/** Tab title: the file name, else the start of the first non-empty line, else "New tab". */
export function tabTitle(content: { text: string; name?: string } | null): string {
  if (!content) return "New tab";
  if (content.name) return content.name.split(/[\\/]/).pop() || content.name;
  const line = content.text.split("\n").find((l) => l.trim())?.replace(/\s+/g, " ").trim() ?? "";
  if (!line) return "New tab";
  return line.length > TITLE_CHARS ? line.slice(0, TITLE_CHARS - 1) + "…" : line;
}
