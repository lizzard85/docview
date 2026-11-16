import * as backend from "./backend";
import type { Content, Settings } from "./backend";
import { decodeText, ENCODING_LABEL, jwtSummary, type Decoded } from "./decode";
import { detectLanguage, type Detection } from "./detect";
import { unwrapEscapedJson } from "./escapedJson";
import { FORMATTABLE, formatCode } from "./format";
import { guessDelimiter, parseCsv } from "./csv";
import { addToHistory, parseHistory, type HistoryEntry } from "./history";
import { HistoryMenu } from "./historyMenu";
import { jsonToTree } from "./jsonTree";
import { LANGUAGES, LANG_BY_ID, languageFromFilename } from "./languages";
import { findOffset, jsonLocations, lineOf, lineStarts, xmlLocations, type Locations } from "./locate";
import { renderMarkdown } from "./markdown";
import { SidePanel, type PanelView } from "./panel";
import type { TreeNode } from "./tree";
import { xmlToTree } from "./xmlTree";
import { MAX_HIGHLIGHT_CHARS, renderCode } from "./render";
import { colouredHtml } from "./richCopy";
import { Search } from "./search";
import { inlineSqlParams } from "./sqlParams";
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
  btnPanel: $<HTMLButtonElement>("btn-panel"),
};

interface State {
  /** What was pasted or opened. */
  original: Content | null;
  /** `original` decoded from JWT / Base64 / URL encoding, if it is encoded. */
  decoded: Decoded | null;
  /** Show the original instead of the decoded text (toggled with D). */
  showOriginal: boolean;
  /** What is shown: the original, or the decoded / unescaped text. */
  content: Content | null;
  detection: Detection | null;
  lang: string;
  shown: string; // the text currently displayed (formatted or original)
  unescaped: number; // levels of string escaping removed from the content (0 = none)
}

const state: State = { original: null, decoded: null, showOriginal: false, content: null, detection: null, lang: "plaintext", shown: "", unescaped: 0 };
let settings: Settings = { ...backend.DEFAULT_SETTINGS };
let renderToken = 0;
const search = new Search(ui.code, $("searchbar"), $<HTMLInputElement>("search"), $("search-count"));
const panel = new SidePanel();
const historyMenu = new HistoryMenu($("history-menu"), $("btn-history"));
let history: HistoryEntry[] = [];

// ------------------------------------------------------------------ setup

for (const l of LANGUAGES) ui.lang.add(new Option(l.label, l.id));

async function init() {
  settings = await backend.loadSettings();
  applySettings();
  if (settings.history) history = parseHistory(await backend.loadHistory().catch(() => []));

  ui.lang.addEventListener("change", () => { state.lang = ui.lang.value; void render(); });
  ui.optFormat.addEventListener("change", () => { settings.format = ui.optFormat.checked; persist(); void render(); });
  ui.optWrap.addEventListener("change", () => { settings.wrap = ui.optWrap.checked; persist(); applySettings(); });
  ui.optLines.addEventListener("change", () => { settings.lineNumbers = ui.optLines.checked; persist(); applySettings(); });

  $("btn-history").addEventListener("click", () => historyMenu.toggle(history, settings.history));
  historyMenu.onPick = (e) => setContent({ text: e.text, name: e.name });
  $("btn-clear-history").addEventListener("click", () => {
    clearHistory();
    toast("History cleared");
  });
  $("btn-paste").addEventListener("click", pasteFromClipboard);
  $("btn-open").addEventListener("click", openFileDialog);
  $("btn-copy").addEventListener("click", copyShown);
  $("btn-copy-rich").addEventListener("click", copyColoured);
  $("btn-editor").addEventListener("click", openInEditor);
  $("btn-settings").addEventListener("click", openSettings);
  ui.btnPanel.addEventListener("click", togglePanel);
  panel.onClose = togglePanel;
  panel.onResize = (w) => { settings.panelWidth = Math.round(w); persist(); };
  panel.onSyncChange = (on) => { settings.panelSync = on; persist(); };
  panel.onNavigate = (node) => jumpToPath(node.path);
  panel.onJumpLine = (line) => jumpToLine(line);
  panel.onHeaderChange = (on) => { settings.csvHeader = on; persist(); };
  panel.onLink = (href) => backend.openUrl(href).catch((e) => toast(`Could not open the link: ${e}`));
  panel.onCopy = async (text, what) => {
    await backend.writeClipboard(text);
    toast(what === "path" ? "Copied path" : "Copied value");
  };
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
  // Encoded text is decoded, unless the file type already says what it is.
  const typed = c.name ? (languageFromFilename(c.name) ?? "plaintext") !== "plaintext" : false;
  state.original = c;
  state.decoded = c.truncated || typed ? null : decodeText(c.text);
  state.showOriginal = false;
  showContent();
  recordHistory(c);
}

// ------------------------------------------------------------------ history

function recordHistory(c: Content) {
  if (!settings.history) return;
  const next = addToHistory(history, { text: c.text, name: c.name, lang: state.detection?.lang ?? "plaintext", time: Date.now() });
  if (next === history) return;
  history = next;
  backend.saveHistory(history).catch((e) => toast(`Could not save the history: ${e}`));
}

function clearHistory() {
  history = [];
  backend.saveHistory([]).catch((e) => toast(`Could not clear the history: ${e}`));
}

/** Shows `state.original`, decoded and/or unescaped as appropriate. */
function showContent() {
  let c = state.original;
  if (!c) return;
  if (state.decoded && !state.showOriginal) c = { ...c, text: state.decoded.text, path: undefined };
  // JSON escaped inside a string is shown as the inner JSON. The file path is
  // dropped so "Open in external editor" opens the shown text, not the file.
  const unwrapped = c.truncated ? null : unwrapEscapedJson(c.text);
  if (unwrapped) c = { ...c, text: unwrapped.text, path: undefined };
  state.unescaped = unwrapped?.levels ?? 0;
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
  const notices: Notice[] = [];
  if (c.truncated) notices.push({ text: "The file is large – only the beginning is shown." });
  const dec = state.decoded;
  if (dec) {
    const label = ENCODING_LABEL[dec.kind];
    if (state.showOriginal) notices.push({ text: `Showing the original ${label} – press D to decode.` });
    else if (dec.kind === "jwt" && dec.payload) notices.push({ text: `${jwtSummary(dec.payload)} Press D to show the original.` });
    else notices.push({ text: `Decoded from ${label} – press D to show the original.` });
  }
  if (state.unescaped === 1) notices.push({ text: "Showing JSON that was escaped inside a string." });
  else if (state.unescaped > 1) notices.push({ text: `Showing JSON that was escaped inside a string (${state.unescaped} levels).` });

  let text = c.text.replace(/\r\n?/g, "\n");
  if (lang === "sql") {
    const inlined = inlineSqlParams(text);
    if (inlined) {
      const from = inlined.kind === "efcore" ? "the EF Core log" : "sp_executesql";
      const toggle = () => { settings.inlineSqlParams = !settings.inlineSqlParams; persist(); void render(); };
      if (settings.inlineSqlParams) {
        text = inlined.sql;
        notices.push({ text: `Parameters from ${from} are inlined.`, action: { label: "Show original", run: toggle } });
      } else {
        notices.push({ text: `This SQL has parameters (${from}).`, action: { label: "Inline parameters", run: toggle } });
      }
    }
  }
  if (settings.format && FORMATTABLE.has(lang)) {
    const r = await formatCode(text, lang, {
      indent: settings.indent,
      printWidth: 100,
      sqlDialect: settings.sqlDialect as never,
      sqlKeywordCase: settings.sqlKeywordCase,
    });
    if (token !== renderToken) return; // a newer render started meanwhile
    text = r.text;
    if (r.error) notices.push({ text: `Could not format as ${LANG_BY_ID.get(lang)?.label}: ${r.error}` });
  }
  if (text.length > MAX_HIGHLIGHT_CHARS) notices.push({ text: "The text is very large – highlighting is turned off." });

  state.shown = text;
  ui.code.className = `code language-${lang}`;
  ui.code.innerHTML = renderCode(text, lang);
  document.body.classList.add("has-content");

  const src = state.detection?.source;
  ui.detectSource.textContent =
    lang !== state.detection?.lang ? "(manual)" : src === "file" ? "(file type)" : src === "parsed" ? "(recognized)" : "(guess)";
  const lines = text.split("\n").length;
  ui.info.textContent = `${c.name ? c.name + " · " : ""}${lines} line${lines === 1 ? "" : "s"}`;
  showNotices(notices);
  search.refresh();
  updatePanel();
}

interface Notice {
  text: string;
  action?: { label: string; run: () => void };
}

function showNotices(notices: Notice[]) {
  ui.notice.replaceChildren();
  for (const n of notices) {
    const item = document.createElement("span");
    item.className = "notice-item";
    item.textContent = n.text;
    if (n.action) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = n.action.label;
      b.addEventListener("click", n.action.run);
      item.append(" ", b);
    }
    ui.notice.append(item);
  }
  ui.notice.hidden = notices.length === 0;
}

// ------------------------------------------------------------------ side panel

let panelCache: { content: Content; lang: string; indent: number; view: PanelView | null } | null = null;

/** What the side panel can show for the current content (cached per content and language). */
function panelView(): PanelView | null {
  const c = state.content;
  if (!c) return null;
  if (panelCache?.content === c && panelCache.lang === state.lang && panelCache.indent === settings.indent) {
    return panelCache.view;
  }
  const parsers: Record<string, (text: string) => TreeNode[]> = {
    json: (t) => jsonToTree(JSON.parse(t), settings.indent),
    xml: (t) => xmlToTree(t, settings.indent),
  };
  const parse = parsers[state.lang];
  let view: PanelView | null = null;
  if (state.lang === "markdown") {
    view = { title: "Preview", html: renderMarkdown(c.text) };
  } else if (state.lang === "csv") {
    const delimiter = guessDelimiter(c.text);
    view = { title: delimiter === "\t" ? "TSV" : "CSV", table: parseCsv(c.text, delimiter) };
  } else if (parse) {
    const title = LANG_BY_ID.get(state.lang)?.label ?? state.lang;
    try {
      view = { title, nodes: parse(c.text) };
    } catch (e) {
      view = { title, error: `Could not parse the ${title}:\n${e instanceof Error ? e.message : e}` };
    }
  }
  panelCache = { content: c, lang: state.lang, indent: settings.indent, view };
  return view;
}

function updatePanel() {
  const view = panelView();
  ui.btnPanel.hidden = !view;
  ui.btnPanel.textContent = view?.html !== undefined ? "Preview" : view?.table ? "Table" : "Tree";
  ui.btnPanel.title = view?.html !== undefined ? "Show Markdown preview (T)" : view?.table ? "Show table view (T)" : "Show tree view (T)";
  ui.btnPanel.classList.toggle("active", !!view && settings.panel);
  panel.update(view, settings.panel);
}

// ------------------------------------------------------------------ jump to line

let locCache: { text: string; lang: string; map: Locations; starts: number[] } | null = null;

/** Scrolls the code view to the line of a tree node (by its JSONPath / XPath). */
function jumpToPath(path: string) {
  const lang = state.lang;
  if (lang !== "json" && lang !== "xml") return;
  // Positions are taken from the text that is shown, which may be formatted.
  if (locCache?.text !== state.shown || locCache.lang !== lang) {
    const map = lang === "json" ? jsonLocations(state.shown) : xmlLocations(state.shown);
    locCache = { text: state.shown, lang, map, starts: lineStarts(state.shown) };
  }
  const offset = findOffset(locCache.map, path, lang);
  if (offset !== undefined) jumpToLine(lineOf(locCache.starts, offset));
}

function jumpToLine(index: number) {
  const line = ui.code.children[index] as HTMLElement | undefined;
  if (!line) return;
  const view = ui.viewer.getBoundingClientRect();
  const rect = line.getBoundingClientRect();
  ui.viewer.scrollTop += rect.top - view.top - (view.height - rect.height) / 2;
  ui.code.querySelector(".jump-target")?.classList.remove("jump-target");
  void line.offsetWidth; // restart the animation when the same line is hit again
  line.classList.add("jump-target");
}

function togglePanel() {
  if (!panelView()) return;
  settings.panel = !settings.panel;
  persist();
  updatePanel();
  if (settings.panel) panel.tree.focus();
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

/** Copies the shown text as highlighted HTML (light theme, inline styles) plus plain text. */
async function copyColoured() {
  if (!state.content) return;
  try {
    await backend.writeClipboardHtml(colouredHtml(state.shown, state.lang), state.shown);
    toast("Copied with colours");
  } catch (e) {
    toast(`Could not copy: ${e}`);
  }
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

/** Switches between the decoded text and the original (D). */
function toggleDecoded() {
  if (!state.decoded) return;
  state.showOriginal = !state.showOriginal;
  showContent();
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
  panel.setWidth(settings.panelWidth);
  panel.setSync(settings.panelSync);
  panel.setCsvHeader(settings.csvHeader);
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
    history: f.history.checked,
  };
  try {
    await backend.saveSettings(next);
  } catch (err) {
    ui.settingsError.textContent = displayShortcut(String(err));
    return;
  }
  // Turning history off also removes what was stored.
  if (settings.history && !next.history) clearHistory();
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
    if (historyMenu.isOpen) historyMenu.close();
    else if (search.isOpen) search.close();
    else void backend.hideWindow();
    return;
  }
  if (mod && key === "f") { e.preventDefault(); search.open(); return; }
  if (e.key === "F3") { e.preventDefault(); search.step(e.shiftKey ? -1 : 1); return; }
  if (isEditable(e.target)) return;

  if (mod && key === "h") { e.preventDefault(); historyMenu.toggle(history, settings.history); }
  else if (mod && key === "o") { e.preventDefault(); void openFileDialog(); }
  else if (mod && e.shiftKey && e.altKey && e.code === "KeyC") { e.preventDefault(); void copyColoured(); }
  else if (mod && e.shiftKey && key === "c") { e.preventDefault(); void copyShown(); }
  else if (mod && key === "e") { e.preventDefault(); void openInEditor(); }
  else if (mod && (key === "+" || key === "=")) { e.preventDefault(); zoom(1); }
  else if (mod && key === "-") { e.preventDefault(); zoom(-1); }
  else if (mod && key === "0") { e.preventDefault(); zoom(0); }
  else if (mod && e.key === ",") { e.preventDefault(); openSettings(); }
  else if (!mod && !e.altKey && key === "f") ui.optFormat.click();
  else if (!mod && !e.altKey && key === "w") ui.optWrap.click();
  else if (!mod && !e.altKey && key === "l") ui.optLines.click();
  else if (!mod && !e.altKey && key === "t") togglePanel();
  else if (!mod && !e.altKey && key === "d") toggleDecoded();
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
