// Keyboard shortcuts inside the app: the list of actions, their default keys,
// the user's remapped keys and turning key events into combo strings.
//
// A combo is stored as modifiers in a fixed order plus one key, e.g.
// "Ctrl+Shift+C", "Ctrl+Plus", "Shift+F3" or "T". Settings only store the
// keys the user changed (`keys`: action id -> combo, "" = no shortcut), so
// new or changed defaults reach existing users.

export type ActionId =
  | "paste" | "open" | "save" | "editor" | "history" | "copy" | "copyRich"
  | "format" | "wrap" | "lineNumbers" | "panel" | "decoded" | "zoomIn" | "zoomOut" | "zoomReset" | "settings"
  | "newTab" | "closeTab" | "nextTab" | "prevTab"
  | "find" | "findNext" | "findPrev"
  | "compare" | "compareNext" | "comparePrev";

export interface ActionDef {
  id: ActionId;
  label: string;
  group: string;
  /** Default combo. */
  key: string;
  /** Where the shortcut works: normal view (default), compare mode, or both. */
  when?: "normal" | "compare" | "both";
  /** Also works while typing in a text field (only with Ctrl/Alt/Win or a function key). */
  inInputs?: boolean;
}

export const ACTIONS: readonly ActionDef[] = [
  { id: "paste", label: "Paste from clipboard", group: "File", key: "Ctrl+V", when: "both" },
  { id: "open", label: "Open file", group: "File", key: "Ctrl+O", when: "both" },
  { id: "save", label: "Save as a file", group: "File", key: "Ctrl+S" },
  { id: "history", label: "History of recent contents", group: "File", key: "Ctrl+H", when: "both" },
  { id: "editor", label: "Open in external editor", group: "File", key: "Ctrl+E" },
  { id: "copy", label: "Copy the shown text", group: "File", key: "Ctrl+Shift+C" },
  { id: "copyRich", label: "Copy with colours", group: "File", key: "Ctrl+Alt+Shift+C" },
  { id: "format", label: "Toggle formatting", group: "View", key: "F" },
  { id: "wrap", label: "Toggle word wrap", group: "View", key: "W" },
  { id: "lineNumbers", label: "Toggle line numbers", group: "View", key: "L" },
  { id: "panel", label: "Toggle the side panel", group: "View", key: "T" },
  { id: "decoded", label: "Switch decoded / original", group: "View", key: "D" },
  { id: "zoomIn", label: "Zoom in", group: "View", key: "Ctrl+Plus" },
  { id: "zoomOut", label: "Zoom out", group: "View", key: "Ctrl+-" },
  { id: "zoomReset", label: "Reset zoom", group: "View", key: "Ctrl+0" },
  { id: "settings", label: "Settings", group: "View", key: "Ctrl+," },
  { id: "newTab", label: "New tab", group: "Tabs", key: "Ctrl+T", inInputs: true },
  { id: "closeTab", label: "Close tab", group: "Tabs", key: "Ctrl+W", inInputs: true },
  { id: "nextTab", label: "Next tab", group: "Tabs", key: "Ctrl+Tab", inInputs: true },
  { id: "prevTab", label: "Previous tab", group: "Tabs", key: "Ctrl+Shift+Tab", inInputs: true },
  { id: "find", label: "Search", group: "Search", key: "Ctrl+F", inInputs: true },
  { id: "findNext", label: "Next match", group: "Search", key: "F3", inInputs: true },
  { id: "findPrev", label: "Previous match", group: "Search", key: "Shift+F3", inInputs: true },
  { id: "compare", label: "Compare with another snippet", group: "Compare", key: "Ctrl+D" },
  { id: "compareNext", label: "Next change", group: "Compare", key: "F7", when: "compare" },
  { id: "comparePrev", label: "Previous change", group: "Compare", key: "Shift+F7", when: "compare" },
];

export const ACTION_BY_ID = new Map(ACTIONS.map((a) => [a.id, a]));

export type KeyOverrides = Partial<Record<ActionId, string>>;
export type Bindings = Record<ActionId, string>;

const MODIFIERS = ["Ctrl", "Alt", "Shift", "Super"] as const;

const MODIFIER_NAMES: Record<string, (typeof MODIFIERS)[number]> = {
  ctrl: "Ctrl", control: "Ctrl", cmdorctrl: "Ctrl", commandorcontrol: "Ctrl",
  alt: "Alt", option: "Alt",
  shift: "Shift",
  super: "Super", win: "Super", windows: "Super", meta: "Super", cmd: "Super", command: "Super",
};

/** Keys that only modify another key; pressing one alone is not a shortcut. */
const MODIFIER_KEYS = new Set([
  "Control", "Shift", "Alt", "AltGraph", "Meta", "OS", "Super", "Hyper", "CapsLock", "NumLock", "ScrollLock",
  "Fn", "FnLock", "Dead", "Unidentified", "Process",
]);

/** Event key names -> combo key names. "+" is the separator, so it is written "Plus". */
const KEY_NAMES: Record<string, string> = {
  " ": "Space", "+": "Plus", "=": "Plus",
  ArrowUp: "Up", ArrowDown: "Down", ArrowLeft: "Left", ArrowRight: "Right", Esc: "Escape",
};

/** Lower-case spellings accepted when reading a stored combo. */
const STORED_KEY_NAMES: Record<string, string> = {
  space: "Space", plus: "Plus", "=": "Plus", minus: "-", comma: ",", period: ".",
  up: "Up", down: "Down", left: "Left", right: "Right", arrowup: "Up", arrowdown: "Down",
  arrowleft: "Left", arrowright: "Right", esc: "Escape", escape: "Escape", tab: "Tab", enter: "Enter",
  return: "Enter", delete: "Delete", del: "Delete", backspace: "Backspace", insert: "Insert",
  home: "Home", end: "End", pageup: "PageUp", pagedown: "PageDown",
};

export interface KeyEventLike {
  key: string;
  code: string;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
}

function joinCombo(mods: Iterable<string>, key: string): string {
  const set = new Set(mods);
  return [...MODIFIERS.filter((m) => set.has(m)), key].join("+");
}

function eventModifiers(e: KeyEventLike, shift: boolean): string[] {
  const mods: string[] = [];
  if (e.ctrlKey) mods.push("Ctrl");
  if (e.altKey) mods.push("Alt");
  if (shift && e.shiftKey) mods.push("Shift");
  if (e.metaKey) mods.push("Super");
  return mods;
}

export function isModifierKey(key: string): boolean {
  return MODIFIER_KEYS.has(key);
}

/** The modifiers held in a key event, e.g. "Ctrl+Shift+" (for a live preview while recording). */
export function heldModifiers(e: KeyEventLike): string {
  const mods = eventModifiers(e, true);
  return mods.length ? `${mods.join("+")}+` : "";
}

/**
 * The combo of a key event, or null for a lone modifier key. Letters and
 * digits are taken from the physical key when the typed character is not one
 * (Alt/Shift may produce other characters). For punctuation the character
 * already reflects Shift, so Shift is not part of the combo ("Ctrl+Plus").
 */
export function eventToCombo(e: KeyEventLike): string | null {
  const { key, code } = e;
  if (!key || isModifierKey(key)) return null;
  if (/^[a-z]$/i.test(key)) return joinCombo(eventModifiers(e, true), key.toUpperCase());
  if (/^Key[A-Z]$/.test(code)) return joinCombo(eventModifiers(e, true), code.slice(3));
  if (/^Digit\d$/.test(code)) return joinCombo(eventModifiers(e, true), code.slice(5));
  if (/^\d$/.test(key)) return joinCombo(eventModifiers(e, true), key);
  if (key.length === 1 && key !== " ") return joinCombo(eventModifiers(e, false), KEY_NAMES[key] ?? key);
  return joinCombo(eventModifiers(e, true), KEY_NAMES[key] ?? key);
}

/** Brings a stored or typed combo to the canonical form; "" if it has no key. */
export function normalizeCombo(s: string): string {
  const trimmed = s.trim();
  if (!trimmed) return "";
  // A trailing "+" is the plus key ("Ctrl++").
  const parts = trimmed.endsWith("++") ? [...trimmed.slice(0, -2).split("+"), "Plus"] : trimmed.split("+");
  const mods: string[] = [];
  let key = "";
  for (const raw of parts.map((p) => p.trim()).filter(Boolean)) {
    const mod = MODIFIER_NAMES[raw.toLowerCase()];
    if (mod) { mods.push(mod); continue; }
    const lower = raw.toLowerCase();
    if (/^[a-z0-9]$/.test(lower)) key = lower.toUpperCase();
    else if (/^f\d{1,2}$/.test(lower)) key = lower.toUpperCase();
    else key = STORED_KEY_NAMES[lower] ?? raw;
  }
  return key ? joinCombo(mods, key) : "";
}

/** The default keys merged with the user's changes. */
export function resolveBindings(overrides: unknown): Bindings {
  const o = (overrides && typeof overrides === "object" ? overrides : {}) as Record<string, unknown>;
  const out = {} as Bindings;
  for (const a of ACTIONS) {
    const v = o[a.id];
    out[a.id] = typeof v === "string" ? normalizeCombo(v) : a.key;
  }
  return out;
}

/** Combo -> action. When a combo is bound twice (hand-edited settings), the first action wins. */
export function keyMap(bindings: Bindings): Map<string, ActionId> {
  const map = new Map<string, ActionId>();
  for (const a of ACTIONS) {
    const combo = bindings[a.id];
    if (combo && !map.has(combo)) map.set(combo, a.id);
  }
  return map;
}

/**
 * Binds `combo` to an action ("" removes its shortcut). Another action that
 * had the same combo loses it; those actions are returned in `unbound`.
 * Keys equal to the default are not stored.
 */
export function setBinding(overrides: KeyOverrides, id: ActionId, combo: string): { overrides: KeyOverrides; unbound: ActionId[] } {
  const next: KeyOverrides = { ...overrides };
  const current = resolveBindings(overrides);
  const unbound: ActionId[] = [];
  const put = (action: ActionId, value: string) => {
    if (value === ACTION_BY_ID.get(action)!.key) delete next[action];
    else next[action] = value;
  };
  const c = normalizeCombo(combo);
  if (c) {
    for (const a of ACTIONS) {
      if (a.id !== id && current[a.id] === c) { put(a.id, ""); unbound.push(a.id); }
    }
  }
  put(id, c);
  return { overrides: next, unbound };
}

/** Whether an action may run from a key event in the given situation. */
export function actionApplies(id: ActionId, combo: string, ctx: { comparing: boolean; inInput: boolean }): boolean {
  const a = ACTION_BY_ID.get(id)!;
  const when = a.when ?? "normal";
  if (ctx.comparing ? when === "normal" : when === "compare") return false;
  if (ctx.inInput) {
    // Plain keys are typed into the field; only real shortcuts pass.
    if (!a.inInputs) return false;
    if (!/(^|\+)(Ctrl|Alt|Super)\+/.test(combo) && !/(^|\+)F\d{1,2}$/.test(combo)) return false;
  }
  return true;
}

// ------------------------------------------------------------------ global shortcut

/**
 * The combo of a key event in the format of the Tauri global-shortcut plugin
 * ("Super+Alt+V", "Ctrl+Shift+F12", "Ctrl+Alt+Minus"). Keys are taken from the
 * physical key, since the OS registers physical keys. Null for a lone modifier.
 */
export function eventToGlobalShortcut(e: KeyEventLike): string | null {
  const { key, code } = e;
  if (!key || isModifierKey(key)) return null;
  let k: string;
  if (/^Key[A-Z]$/.test(code)) k = code.slice(3);
  else if (/^Digit\d$/.test(code)) k = code.slice(5);
  else if (/^F\d{1,2}$/.test(code)) k = code;
  else if (code) k = code;
  else if (/^[a-z0-9]$/i.test(key)) k = key.toUpperCase();
  else return null;
  // The Windows/Super key first, as in the default "Super+Alt+V".
  const mods = eventModifiers(e, true);
  return [...(mods.includes("Super") ? ["Super"] : []), ...mods.filter((m) => m !== "Super"), k].join("+");
}

/** Why a combo cannot be used as the global shortcut, or null when it can. */
export function globalShortcutProblem(combo: string): string | null {
  const parts = combo.split("+");
  const key = parts[parts.length - 1];
  const mods = parts.slice(0, -1);
  if (/^F\d{1,2}$/.test(key)) return null;
  if (!mods.some((m) => m === "Ctrl" || m === "Alt" || m === "Super")) {
    return "The global shortcut works in every program, so it needs Ctrl, Alt or the Windows/Super key (or use a function key).";
  }
  return null;
}
