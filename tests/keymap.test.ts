import { describe, expect, it } from "vitest";
import {
  ACTIONS, actionApplies, eventToCombo, eventToGlobalShortcut, globalShortcutProblem, heldModifiers, keyMap,
  normalizeCombo, resolveBindings, setBinding, type KeyEventLike,
} from "../src/keymap";

function ev(key: string, code: string, mods: Partial<KeyEventLike> = {}): KeyEventLike {
  return { key, code, ctrlKey: false, altKey: false, shiftKey: false, metaKey: false, ...mods };
}

describe("eventToCombo", () => {
  it("writes modifiers in a fixed order and letters in upper case", () => {
    expect(eventToCombo(ev("c", "KeyC", { ctrlKey: true }))).toBe("Ctrl+C");
    expect(eventToCombo(ev("C", "KeyC", { ctrlKey: true, shiftKey: true }))).toBe("Ctrl+Shift+C");
    expect(eventToCombo(ev("t", "KeyT"))).toBe("T");
  });
  it("uses the physical letter when Alt produces another character", () => {
    expect(eventToCombo(ev("©", "KeyC", { ctrlKey: true, altKey: true, shiftKey: true }))).toBe("Ctrl+Alt+Shift+C");
  });
  it("uses the digit key, not the shifted character", () => {
    expect(eventToCombo(ev("=", "Digit0", { ctrlKey: true, shiftKey: true }))).toBe("Ctrl+Shift+0");
    expect(eventToCombo(ev("0", "Digit0", { ctrlKey: true }))).toBe("Ctrl+0");
  });
  it("drops Shift for punctuation and names the plus key", () => {
    expect(eventToCombo(ev("+", "Equal", { ctrlKey: true, shiftKey: true }))).toBe("Ctrl+Plus");
    expect(eventToCombo(ev("=", "Equal", { ctrlKey: true }))).toBe("Ctrl+Plus");
    expect(eventToCombo(ev("+", "NumpadAdd", { ctrlKey: true }))).toBe("Ctrl+Plus");
    expect(eventToCombo(ev("-", "Slash", { ctrlKey: true }))).toBe("Ctrl+-");
    expect(eventToCombo(ev(",", "Comma", { ctrlKey: true }))).toBe("Ctrl+,");
  });
  it("keeps Shift for named and function keys", () => {
    expect(eventToCombo(ev("Tab", "Tab", { ctrlKey: true, shiftKey: true }))).toBe("Ctrl+Shift+Tab");
    expect(eventToCombo(ev("F3", "F3", { shiftKey: true }))).toBe("Shift+F3");
    expect(eventToCombo(ev(" ", "Space", { ctrlKey: true }))).toBe("Ctrl+Space");
    expect(eventToCombo(ev("ArrowUp", "ArrowUp", { altKey: true }))).toBe("Alt+Up");
  });
  it("maps the Windows/Meta key to Super", () => {
    expect(eventToCombo(ev("k", "KeyK", { metaKey: true }))).toBe("Super+K");
  });
  it("ignores lone modifier keys", () => {
    expect(eventToCombo(ev("Control", "ControlLeft", { ctrlKey: true }))).toBeNull();
    expect(eventToCombo(ev("Shift", "ShiftLeft", { shiftKey: true }))).toBeNull();
    expect(eventToCombo(ev("Dead", "BracketRight"))).toBeNull();
  });
  it("has the defaults in the canonical form", () => {
    for (const a of ACTIONS) expect(normalizeCombo(a.key)).toBe(a.key);
  });
});

describe("heldModifiers", () => {
  it("lists the held modifiers", () => {
    expect(heldModifiers(ev("Shift", "ShiftLeft", { ctrlKey: true, shiftKey: true }))).toBe("Ctrl+Shift+");
    expect(heldModifiers(ev("a", "KeyA"))).toBe("");
  });
});

describe("normalizeCombo", () => {
  it("canonicalizes names, case and order", () => {
    expect(normalizeCombo("shift+ctrl+c")).toBe("Ctrl+Shift+C");
    expect(normalizeCombo("Control+Alt+Shift+c")).toBe("Ctrl+Alt+Shift+C");
    expect(normalizeCombo("Win+k")).toBe("Super+K");
    expect(normalizeCombo("Ctrl++")).toBe("Ctrl+Plus");
    expect(normalizeCombo("ctrl+plus")).toBe("Ctrl+Plus");
    expect(normalizeCombo("shift+f3")).toBe("Shift+F3");
    expect(normalizeCombo("ctrl+tab")).toBe("Ctrl+Tab");
    expect(normalizeCombo("Ctrl+-")).toBe("Ctrl+-");
  });
  it("returns an empty string without a key", () => {
    expect(normalizeCombo("")).toBe("");
    expect(normalizeCombo("Ctrl+Shift")).toBe("");
  });
});

describe("resolveBindings / keyMap", () => {
  it("uses the defaults when nothing is changed", () => {
    const b = resolveBindings({});
    expect(b.open).toBe("Ctrl+O");
    expect(keyMap(b).get("Ctrl+Shift+C")).toBe("copy");
    expect(keyMap(b).get("Ctrl+Alt+Shift+C")).toBe("copyRich");
  });
  it("has no duplicate default combos", () => {
    expect(keyMap(resolveBindings({})).size).toBe(ACTIONS.length);
  });
  it("applies changes and removed shortcuts", () => {
    const b = resolveBindings({ open: "ctrl+shift+o", panel: "" });
    expect(b.open).toBe("Ctrl+Shift+O");
    expect(b.panel).toBe("");
    const map = keyMap(b);
    expect(map.get("Ctrl+Shift+O")).toBe("open");
    expect(map.has("Ctrl+O")).toBe(false);
    expect(map.has("T")).toBe(false);
  });
  it("ignores invalid stored values", () => {
    expect(resolveBindings("nonsense").open).toBe("Ctrl+O");
    expect(resolveBindings({ open: 42 }).open).toBe("Ctrl+O");
  });
});

describe("setBinding", () => {
  it("stores only keys that differ from the default", () => {
    const { overrides } = setBinding({}, "open", "Ctrl+Shift+O");
    expect(overrides).toEqual({ open: "Ctrl+Shift+O" });
    expect(setBinding(overrides, "open", "Ctrl+O").overrides).toEqual({});
  });
  it("removes the combo from the action that had it", () => {
    const { overrides, unbound } = setBinding({}, "save", "Ctrl+O");
    expect(unbound).toEqual(["open"]);
    expect(overrides).toEqual({ save: "Ctrl+O", open: "" });
    const b = resolveBindings(overrides);
    expect(b.open).toBe("");
    expect(keyMap(b).get("Ctrl+O")).toBe("save");
  });
  it("can remove a shortcut", () => {
    expect(setBinding({}, "panel", "").overrides).toEqual({ panel: "" });
  });
  it("does not count the action itself as a conflict", () => {
    expect(setBinding({}, "open", "Ctrl+O").unbound).toEqual([]);
  });
});

describe("actionApplies", () => {
  const normal = { comparing: false, inInput: false };
  it("respects compare mode", () => {
    expect(actionApplies("compareNext", "F7", normal)).toBe(false);
    expect(actionApplies("compareNext", "F7", { comparing: true, inInput: false })).toBe(true);
    expect(actionApplies("save", "Ctrl+S", { comparing: true, inInput: false })).toBe(false);
    expect(actionApplies("open", "Ctrl+O", { comparing: true, inInput: false })).toBe(true);
  });
  it("only lets real shortcuts through while typing", () => {
    const typing = { comparing: false, inInput: true };
    expect(actionApplies("find", "Ctrl+F", typing)).toBe(true);
    expect(actionApplies("findNext", "F3", typing)).toBe(true);
    expect(actionApplies("findNext", "N", typing)).toBe(false);
    expect(actionApplies("findPrev", "Shift+N", typing)).toBe(false);
    expect(actionApplies("format", "F", typing)).toBe(false);
    expect(actionApplies("open", "Ctrl+O", typing)).toBe(false);
  });
});

describe("global shortcut", () => {
  it("records physical keys in the Tauri format", () => {
    expect(eventToGlobalShortcut(ev("v", "KeyV", { metaKey: true, altKey: true }))).toBe("Super+Alt+V");
    expect(eventToGlobalShortcut(ev("F12", "F12", { ctrlKey: true, shiftKey: true }))).toBe("Ctrl+Shift+F12");
    expect(eventToGlobalShortcut(ev("+", "Minus", { ctrlKey: true, altKey: true }))).toBe("Ctrl+Alt+Minus");
    expect(eventToGlobalShortcut(ev("!", "Digit1", { altKey: true, shiftKey: true }))).toBe("Alt+Shift+1");
    expect(eventToGlobalShortcut(ev("Alt", "AltLeft", { altKey: true }))).toBeNull();
  });
  it("needs Ctrl, Alt or Super unless it is a function key", () => {
    expect(globalShortcutProblem("Super+Alt+V")).toBeNull();
    expect(globalShortcutProblem("F9")).toBeNull();
    expect(globalShortcutProblem("Shift+F9")).toBeNull();
    expect(globalShortcutProblem("V")).not.toBeNull();
    expect(globalShortcutProblem("Shift+V")).not.toBeNull();
  });
});
