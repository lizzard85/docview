// The "Shortcuts" page of the settings dialog: the global shortcut and every
// app shortcut, each recorded by clicking its key button and pressing the
// combination (no typing of key names).

import {
  ACTIONS, ACTION_BY_ID, eventToCombo, eventToGlobalShortcut, globalShortcutProblem, heldModifiers,
  isModifierKey, resolveBindings, setBinding, type ActionId, type KeyOverrides,
} from "./keymap";
import { displayShortcut } from "./shortcut";

type Target = ActionId | "global";

export class KeysEditor {
  private overrides: KeyOverrides = {};
  private globalShortcut = "";
  private defaultGlobal = "";
  private recording: { target: Target; button: HTMLButtonElement } | null = null;
  /** Set briefly after Esc cancelled a recording, so the dialog does not close too. */
  private escapeUsed = false;
  private readonly buttons = new Map<Target, HTMLButtonElement>();
  private readonly resets = new Map<Target, HTMLButtonElement>();

  constructor(
    private readonly root: HTMLElement,
    private readonly status: HTMLElement,
  ) {
    this.build();
    window.addEventListener("keydown", this.onKeyDown, true);
    window.addEventListener("keyup", this.onKeyUp, true);
  }

  /** Loads the current settings into the editor. */
  load(overrides: KeyOverrides, globalShortcut: string, defaultGlobal: string) {
    this.stop();
    this.overrides = { ...overrides };
    this.globalShortcut = globalShortcut;
    this.defaultGlobal = defaultGlobal;
    this.setStatus("");
    this.render();
  }

  get keys(): KeyOverrides {
    return { ...this.overrides };
  }

  get global(): string {
    return this.globalShortcut;
  }

  /** True once if the last Esc only cancelled a recording (the dialog should stay open). */
  takeEscape(): boolean {
    const used = this.escapeUsed || !!this.recording;
    this.escapeUsed = false;
    this.stop();
    return used;
  }

  stop() {
    if (!this.recording) return;
    this.recording.button.classList.remove("recording");
    this.recording = null;
    this.render();
  }

  // ---------------------------------------------------------------- building

  private build() {
    const groups = new Map<string, HTMLElement>();
    const section = (title: string, hint?: string) => {
      const h = document.createElement("h3");
      h.textContent = title;
      const table = document.createElement("div");
      table.className = "keys-table";
      this.root.append(h);
      if (hint) {
        const p = document.createElement("p");
        p.className = "muted keys-hint";
        p.textContent = hint;
        this.root.append(p);
      }
      this.root.append(table);
      return table;
    };

    const global = section(
      "Global shortcut",
      "Works in every program: shows DocView with what is on the clipboard.",
    );
    this.addRow(global, "global", "Show the clipboard in DocView");

    for (const a of ACTIONS) {
      let table = groups.get(a.group);
      if (!table) {
        table = section(a.group);
        groups.set(a.group, table);
      }
      this.addRow(table, a.id, a.label);
    }

    const footer = document.createElement("p");
    footer.className = "keys-footer";
    const note = document.createElement("span");
    note.className = "muted";
    note.textContent = "Click a shortcut and press the new keys. Esc cancels.";
    const resetAll = document.createElement("button");
    resetAll.type = "button";
    resetAll.textContent = "Reset all to defaults";
    resetAll.addEventListener("click", () => {
      this.stop();
      this.overrides = {};
      this.globalShortcut = this.defaultGlobal;
      this.setStatus("All shortcuts are back to their defaults.");
      this.render();
    });
    footer.append(note, resetAll);
    this.root.append(footer);
  }

  private addRow(table: HTMLElement, target: Target, label: string) {
    const name = document.createElement("span");
    name.className = "keys-label";
    name.textContent = label;

    const key = document.createElement("button");
    key.type = "button";
    key.className = "key-record";
    key.title = "Click and press the new shortcut";
    key.addEventListener("click", () => this.start(target, key));
    key.addEventListener("blur", () => { if (this.recording?.button === key) this.stop(); });

    const reset = document.createElement("button");
    reset.type = "button";
    reset.className = "icon";
    reset.title = "Reset to the default";
    reset.setAttribute("aria-label", `Reset ${label} to the default`);
    reset.textContent = "↺";
    reset.addEventListener("click", () => this.reset(target));

    const clear = document.createElement("button");
    clear.type = "button";
    clear.className = "icon";
    clear.title = "Remove the shortcut";
    clear.setAttribute("aria-label", `Remove the shortcut for ${label}`);
    clear.textContent = "✕";
    clear.hidden = target === "global"; // the global shortcut cannot be empty
    clear.addEventListener("click", () => this.assign(target, ""));

    const actions = document.createElement("span");
    actions.className = "keys-actions";
    actions.append(key, reset, clear);
    table.append(name, actions);
    this.buttons.set(target, key);
    this.resets.set(target, reset);
  }

  // ---------------------------------------------------------------- state

  private render() {
    const bindings = resolveBindings(this.overrides);
    for (const [target, button] of this.buttons) {
      if (this.recording?.button === button) continue;
      const combo = target === "global" ? this.globalShortcut : bindings[target];
      button.textContent = combo ? displayShortcut(combo) : "None";
      button.classList.toggle("unset", !combo);
      const isDefault = target === "global" ? combo === this.defaultGlobal : !(target in this.overrides);
      this.resets.get(target)!.disabled = isDefault;
    }
  }

  private setStatus(text: string) {
    this.status.textContent = text;
    this.status.hidden = !text;
  }

  private start(target: Target, button: HTMLButtonElement) {
    if (this.recording?.button === button) { this.stop(); return; }
    this.stop();
    this.recording = { target, button };
    button.classList.add("recording");
    button.textContent = "Press keys…";
    this.setStatus("");
  }

  private reset(target: Target) {
    this.stop();
    if (target === "global") this.assign(target, this.defaultGlobal);
    else this.assign(target, ACTION_BY_ID.get(target)!.key);
  }

  private assign(target: Target, combo: string) {
    if (target === "global") {
      this.globalShortcut = combo;
      this.setStatus("");
    } else {
      const { overrides, unbound } = setBinding(this.overrides, target, combo);
      this.overrides = overrides;
      this.setStatus(
        unbound.length
          ? `${displayShortcut(combo)} was used by “${unbound.map((id) => ACTION_BY_ID.get(id)!.label).join("”, “")}”, which now has no shortcut.`
          : "",
      );
    }
    this.render();
  }

  private readonly onKeyDown = (e: KeyboardEvent) => {
    const rec = this.recording;
    if (!rec) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.key === "Escape" && !e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey) {
      this.escapeUsed = true;
      setTimeout(() => (this.escapeUsed = false), 200);
      this.stop();
      return;
    }
    if (isModifierKey(e.key)) {
      rec.button.textContent = `${displayShortcut(heldModifiers(e))}…`;
      return;
    }
    if (rec.target === "global") {
      const combo = eventToGlobalShortcut(e);
      if (!combo) return;
      const problem = globalShortcutProblem(combo);
      this.stop();
      if (problem) { this.setStatus(problem); return; }
      this.assign("global", combo);
    } else {
      const combo = eventToCombo(e);
      if (!combo) return;
      this.stop();
      this.assign(rec.target, combo);
    }
  };

  private readonly onKeyUp = (e: KeyboardEvent) => {
    const rec = this.recording;
    if (!rec || !isModifierKey(e.key)) return;
    const held = heldModifiers(e);
    rec.button.textContent = held ? `${displayShortcut(held)}…` : "Press keys…";
  };
}
