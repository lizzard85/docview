import * as backend from "./backend";
import type { Content, Settings } from "./backend";
import { detectLanguage, type Detection } from "./detect";
import { FORMATTABLE, formatCode } from "./format";
import { LANGUAGES, LANG_BY_ID } from "./languages";
import { MAX_HIGHLIGHT_CHARS, renderCode } from "./render";
import { Search } from "./search";
import { displayShortcut, isWindows, storeShortcut } from "./shortcut";
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
  settingsUpdate: $("settings-update"),
  settingsToast: $("settings-toast"),
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
    ui.shortcutHint.textContent = `${displayShortcut(scError)} Pick another shortcut under Settings (⚙).`;
  }
  if (isWindows) {
    (ui.settingsForm.elements.namedItem("shortcut") as HTMLInputElement).placeholder = "Win+Alt+V";
    $("shortcut-help").innerHTML = "E.g. <code>Win+Alt+V</code>, <code>Ctrl+Shift+F12</code>.";
  }

  $("btn-check-update").addEventListener("click", () => void checkForUpdate(updateUi, true));
  ui.appVersion.textContent = `Version ${await appVersion()}`;
  if (backend.isTauri) {
    setTimeout(autoCheck, 10_000);
    setInterval(autoCheck, 6 * 60 * 60 * 1000);
  }
}

// ------------------------------------------------------------------ updates

// The update notice is shown both in the main window and inside the settings
// dialog, so an update can be installed without closing settings first.
const updateBars = [ui.updateBar, ui.settingsUpdate];

const updateUi: UpdateUi = {
  notice(message, actions = []) {
    for (const bar of updateBars) {
      bar.replaceChildren(document.createTextNode(message));
      for (const a of actions) {
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = a.label;
        if (a.primary) b.className = "primary";
        b.addEventListener("click", a.run);
        bar.append(b);
      }
      bar.hidden = false;
    }
  },
  clearNotice() {
    for (const bar of updateBars) {
      bar.hidden = true;
      bar.replaceChildren();
    }
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
  if (c.truncated) notices.push("The file is large – only the beginning is shown.");

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
    if (r.error) notices.push(`Could not format as ${LANG_BY_ID.get(lang)?.label}: ${r.error}`);
  }
  if (text.length > MAX_HIGHLIGHT_CHARS) notices.push("The text is very large – highlighting is turned off.");

  state.shown = text;
  ui.code.className = `code language-${lang}`;
  ui.code.innerHTML = renderCode(text, lang);
  document.body.classList.add("has-content");

  const src = state.detection?.source;
  ui.detectSource.textContent =
    lang !== state.detection?.lang ? "(manual)" : src === "file" ? "(file type)" : src === "parsed" ? "(recognized)" : "(guess)";
  const lines = text.split("\n").length;
  ui.info.textContent = `${c.name ? c.name + " · " : ""}${lines} line${lines === 1 ? "" : "s"}`;
  ui.notice.textContent = notices.join("  ");
  ui.notice.hidden = notices.length === 0;
  search.refresh();
}

// ------------------------------------------------------------------ actions

async function pasteFromClipboard() {
  try {
    const text = await backend.readClipboard();
    if (text) setContent({ text });
    else toast("The clipboard contains no text");
  } catch (e) {
    toast(`Could not read the clipboard: ${e}`);
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
    toast(`Could not open the file: ${e}`);
  }
}

async function copyShown() {
  if (!state.content) return;
  await backend.writeClipboard(state.shown);
  toast("Copied");
}

async function openInEditor() {
  if (!state.content) return;
  try {
    // An unmodified file is opened directly; otherwise the shown text goes to a temp file.
    const path = state.content.path && !state.content.truncated && !settings.format ? state.content.path : undefined;
    await backend.openInEditor(state.shown, LANG_BY_ID.get(state.lang)?.ext ?? "txt", path);
  } catch (e) {
    toast(`Could not open the editor: ${e}`);
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
    ? `Global shortcut: ${displayShortcut(settings.shortcut)} – shows what is on the clipboard.`
    : "";
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
  f.shortcut.value = displayShortcut(settings.shortcut);
  ui.settingsError.textContent = "";
  ui.settingsToast.hidden = true;
  ui.settings.showModal();
}

async function onSettingsSubmit(e: SubmitEvent) {
  const submitter = e.submitter as HTMLButtonElement | null;
  if (submitter?.value !== "save") return;
  e.preventDefault();
  const f = ui.settingsForm.elements as unknown as Record<string, HTMLInputElement>;
  const next: Settings = {
    ...settings,
    shortcut: storeShortcut(f.shortcut.value) || backend.DEFAULT_SETTINGS.shortcut,
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
    ui.settingsError.textContent = displayShortcut(String(err));
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
  // The modal settings dialog covers the normal toast, so show it in the dialog instead.
  const el = ui.settings.open ? ui.settingsToast : ui.toast;
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (el.hidden = true), el === ui.toast ? 2500 : 5000);
}

void init();
