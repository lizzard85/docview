import * as backend from "./backend";
import type { Content, Settings } from "./backend";
import { detectLanguage, type Detection } from "./detect";
import { FORMATTABLE, formatCode } from "./format";
import { LANGUAGES, LANG_BY_ID } from "./languages";
import { MAX_HIGHLIGHT_CHARS, renderCode } from "./render";
import { Search } from "./search";
import { appVersion, checkForUpdate, type UpdateUi } from "./update";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const ui = {
  lang: $<HTMLSelectElement>("lang"),
  detectSource: $("detect-source"),
  optFormat: $<HTMLInputElement>("opt-format"),
  optWrap: $<HTMLInputElement>("opt-wrap"),
  optLines: $<HTMLInputElement>("opt-lines"),
  info: $("info"),
  code: $("code"),
  viewer: $("viewer"),
  notice: $("notice"),
  updateBar: $("update-bar"),
  appVersion: $("app-version"),
  toast: $("toast"),
  shortcutHint: $("shortcut-hint"),
  settings: $<HTMLDialogElement>("settings"),
  settingsForm: $<HTMLFormElement>("settings-form"),
  settingsError: $("settings-error"),
};

interface State {
  content: Content | null;
  detection: Detection | null;
  lang: string;
  shown: string; // the text currently displayed (formatted or original)
}

const state: State = { content: null, detection: null, lang: "plaintext", shown: "" };
let settings: Settings = { ...backend.DEFAULT_SETTINGS };
let renderToken = 0;
const search = new Search(ui.code, $("searchbar"), $<HTMLInputElement>("search"), $("search-count"));

// ------------------------------------------------------------------ setup

for (const l of LANGUAGES) ui.lang.add(new Option(l.label, l.id));

async function init() {
  settings = await backend.loadSettings();
  applySettings();

  ui.lang.addEventListener("change", () => { state.lang = ui.lang.value; void render(); });
  ui.optFormat.addEventListener("change", () => { settings.format = ui.optFormat.checked; persist(); void render(); });
  ui.optWrap.addEventListener("change", () => { settings.wrap = ui.optWrap.checked; persist(); applySettings(); });
  ui.optLines.addEventListener("change", () => { settings.lineNumbers = ui.optLines.checked; persist(); applySettings(); });

  $("btn-paste").addEventListener("click", pasteFromClipboard);
  $("btn-open").addEventListener("click", openFileDialog);
  $("btn-copy").addEventListener("click", copyShown);
  $("btn-editor").addEventListener("click", openInEditor);
  $("btn-settings").addEventListener("click", openSettings);
  ui.settingsForm.addEventListener("submit", onSettingsSubmit);

  document.addEventListener("paste", (e) => {
    if (isEditable(e.target) || ui.settings.open) return;
    const text = e.clipboardData?.getData("text/plain");
    if (text) { e.preventDefault(); setContent({ text }); }
  });
  document.addEventListener("keydown", onKey);
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applySettings);

  if (!backend.isTauri) {
    $("btn-editor").hidden = true;
  }

  await backend.onPending(loadPending);
  await backend.onMenu((action) => {
    if (action === "open") void openFileDialog();
    else if (action === "settings") openSettings();
    else if (action === "check-update") void checkForUpdate(updateUi, true);
  });
  await backend.onFileDrop((path) => void openPath(path));
  await loadPending();
  const scError = await backend.shortcutStatus();
  if (scError && !state.content) {
    ui.shortcutHint.textContent = `${scError} Vælg en anden genvej under Indstillinger (⚙).`;
  }

  $("btn-check-update").addEventListener("click", () => void checkForUpdate(updateUi, true));
  ui.appVersion.textContent = `Version ${await appVersion()}`;
  if (backend.isTauri) {
    setTimeout(autoCheck, 10_000);
    setInterval(autoCheck, 6 * 60 * 60 * 1000);
  }
}

// ------------------------------------------------------------------ updates

const updateUi: UpdateUi = {
  notice(message, actions = []) {
    ui.updateBar.replaceChildren(document.createTextNode(message));
    for (const a of actions) {
      const b = document.createElement("button");
      b.textContent = a.label;
      if (a.primary) b.className = "primary";
      b.addEventListener("click", a.run);
      ui.updateBar.append(b);
    }
    ui.updateBar.hidden = false;
  },
  clearNotice() {
    ui.updateBar.hidden = true;
    ui.updateBar.replaceChildren();
  },
  toast: (m) => toast(m),
};

function autoCheck() {
  if (settings.autoUpdate) void checkForUpdate(updateUi, false);
}

async function loadPending() {
  const c = await backend.takePending();
  if (c) setContent(c);
}

// ------------------------------------------------------------------ content

function setContent(c: Content) {
  state.content = c;
  state.detection = detectLanguage(c.text, c.name);
  state.lang = state.detection.lang;
  ui.lang.value = state.lang;
  void backend.setTitle(c.name ? `${c.name} – DocView` : "DocView");
  ui.viewer.scrollTo(0, 0);
  void render();
}

async function render() {
  const c = state.content;
  if (!c) return;
  const token = ++renderToken;
  const lang = state.lang;
  const notices: string[] = [];
  if (c.truncated) notices.push("Filen er stor – kun begyndelsen vises.");

  let text = c.text.replace(/\r\n?/g, "\n");
  if (settings.format && FORMATTABLE.has(lang)) {
    const r = await formatCode(text, lang, {
      indent: settings.indent,
      printWidth: 100,
      sqlDialect: settings.sqlDialect as never,
      sqlKeywordCase: settings.sqlKeywordCase,
    });
    if (token !== renderToken) return; // a newer render started meanwhile
    text = r.text;
    if (r.error) notices.push(`Kunne ikke formatere som ${LANG_BY_ID.get(lang)?.label}: ${r.error}`);
  }
  if (text.length > MAX_HIGHLIGHT_CHARS) notices.push("Teksten er meget stor – farvelægning er slået fra.");

  state.shown = text;
  ui.code.className = `code language-${lang}`;
  ui.code.innerHTML = renderCode(text, lang);
  document.body.classList.add("has-content");

  const src = state.detection?.source;
  ui.detectSource.textContent =
    lang !== state.detection?.lang ? "(valgt manuelt)" : src === "file" ? "(filtype)" : src === "parsed" ? "(genkendt)" : "(gæt)";
  const lines = text.split("\n").length;
  ui.info.textContent = `${c.name ? c.name + " · " : ""}${lines} linje${lines === 1 ? "" : "r"}`;
  ui.notice.textContent = notices.join("  ");
  ui.notice.hidden = notices.length === 0;
  search.refresh();
}

// ------------------------------------------------------------------ actions

async function pasteFromClipboard() {
  try {
    const text = await backend.readClipboard();
    if (text) setContent({ text });
    else toast("Udklipsholderen indeholder ingen tekst");
  } catch (e) {
    toast(`Kunne ikke læse udklipsholderen: ${e}`);
  }
}

async function openFileDialog() {
  if (!backend.isTauri) {
    const input = document.createElement("input");
    input.type = "file";
    input.onchange = async () => {
      const f = input.files?.[0];
      if (f) setContent({ text: await f.text(), name: f.name });
    };
    input.click();
    return;
  }
  const path = await backend.pickFile();
  if (path) await openPath(path);
}

async function openPath(path: string) {
  try {
    setContent(await backend.readFile(path));
  } catch (e) {
    toast(`Kunne ikke åbne filen: ${e}`);
  }
}

async function copyShown() {
  if (!state.content) return;
  await backend.writeClipboard(state.shown);
  toast("Kopieret");
}

async function openInEditor() {
  if (!state.content) return;
  try {
    // An unmodified file is opened directly; otherwise the shown text goes to a temp file.
    const path = state.content.path && !state.content.truncated && !settings.format ? state.content.path : undefined;
    await backend.openInEditor(state.shown, LANG_BY_ID.get(state.lang)?.ext ?? "txt", path);
  } catch (e) {
    toast(`Kunne ikke åbne editor: ${e}`);
  }
}

function zoom(delta: number) {
  settings.fontSize = delta === 0 ? 14 : Math.min(40, Math.max(8, settings.fontSize + delta));
  applySettings();
  persist();
}

// ------------------------------------------------------------------ settings

function applySettings() {
  const root = document.documentElement;
  if (settings.theme === "auto") delete root.dataset.theme;
  else root.dataset.theme = settings.theme;
  root.style.setProperty("--font-size", `${settings.fontSize}px`);
  document.body.classList.toggle("wrap", settings.wrap);
  document.body.classList.toggle("no-lines", !settings.lineNumbers);
  ui.optFormat.checked = settings.format;
  ui.optWrap.checked = settings.wrap;
  ui.optLines.checked = settings.lineNumbers;
  ui.shortcutHint.textContent = backend.isTauri
    ? `Global genvej: ${prettyShortcut(settings.shortcut)} – viser indholdet af udklipsholderen.`
    : "";
}

function prettyShortcut(s: string): string {
  const win = navigator.userAgent.includes("Windows");
  return s.replace(/\bSuper\b/i, win ? "Win" : "Super");
}

let persistTimer: number | undefined;
function persist() {
  clearTimeout(persistTimer);
  persistTimer = window.setTimeout(() => {
    backend.saveSettings(settings).catch((e) => toast(String(e)));
  }, 300);
}

function openSettings() {
  const f = ui.settingsForm.elements as unknown as Record<string, HTMLInputElement>;
  for (const [key, value] of Object.entries(settings)) {
    const el = f[key];
    if (!el) continue;
    if (el.type === "checkbox") el.checked = Boolean(value);
    else el.value = String(value);
  }
  ui.settingsError.textContent = "";
  ui.settings.showModal();
}

async function onSettingsSubmit(e: SubmitEvent) {
  const submitter = e.submitter as HTMLButtonElement | null;
  if (submitter?.value !== "save") return;
  e.preventDefault();
  const f = ui.settingsForm.elements as unknown as Record<string, HTMLInputElement>;
  const next: Settings = {
    ...settings,
    shortcut: f.shortcut.value.trim() || backend.DEFAULT_SETTINGS.shortcut,
    theme: f.theme.value as Settings["theme"],
    fontSize: Number(f.fontSize.value) || 14,
    indent: Number(f.indent.value) || 2,
    sqlDialect: f.sqlDialect.value,
    sqlKeywordCase: f.sqlKeywordCase.value as Settings["sqlKeywordCase"],
    editorPath: f.editorPath.value.trim(),
    autostart: f.autostart.checked,
    autoUpdate: f.autoUpdate.checked,
  };
  try {
    await backend.saveSettings(next);
  } catch (err) {
    ui.settingsError.textContent = String(err);
    return;
  }
  settings = next;
  ui.settings.close();
  applySettings();
  void render();
}

// ------------------------------------------------------------------ keyboard

function isEditable(t: EventTarget | null): boolean {
  return t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement;
}

function onKey(e: KeyboardEvent) {
  if (ui.settings.open) return;
  const mod = e.ctrlKey || e.metaKey;
  const key = e.key.toLowerCase();

  if (e.key === "Escape") {
    if (search.isOpen) search.close();
    else void backend.hideWindow();
    return;
  }
  if (mod && key === "f") { e.preventDefault(); search.open(); return; }
  if (e.key === "F3") { e.preventDefault(); search.step(e.shiftKey ? -1 : 1); return; }
  if (isEditable(e.target)) return;

  if (mod && key === "o") { e.preventDefault(); void openFileDialog(); }
  else if (mod && e.shiftKey && key === "c") { e.preventDefault(); void copyShown(); }
  else if (mod && key === "e") { e.preventDefault(); void openInEditor(); }
  else if (mod && (key === "+" || key === "=")) { e.preventDefault(); zoom(1); }
  else if (mod && key === "-") { e.preventDefault(); zoom(-1); }
  else if (mod && key === "0") { e.preventDefault(); zoom(0); }
  else if (mod && e.key === ",") { e.preventDefault(); openSettings(); }
  else if (!mod && !e.altKey && key === "f") ui.optFormat.click();
  else if (!mod && !e.altKey && key === "w") ui.optWrap.click();
  else if (!mod && !e.altKey && key === "l") ui.optLines.click();
}

// ------------------------------------------------------------------ misc

let toastTimer: number | undefined;
function toast(msg: string) {
  ui.toast.textContent = msg;
  ui.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (ui.toast.hidden = true), 2500);
}

void init();
