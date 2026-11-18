// Fonts are bundled (no requests to the internet at runtime).
import "@fontsource/figtree/400.css";
import "@fontsource/figtree/500.css";
import "@fontsource/figtree/600.css";
import "@fontsource/figtree/700.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/600.css";
import "@fontsource/jetbrains-mono/700.css";
import * as backend from "./backend";
import type { Content, Settings } from "./backend";
import { decodeText, ENCODING_LABEL, jwtExpired, jwtSummary, type Decoded } from "./decode";
import { detectLanguage, type Detection } from "./detect";
import { unwrapEscapedJson } from "./escapedJson";
import { FORMATTABLE, formatCode } from "./format";
import { guessDelimiter, parseCsv } from "./csv";
import { addToHistory, parseHistory, relativeTime, type HistoryEntry } from "./history";
import { diffTexts, normalizeForCompare } from "./compare";
import { CompareView } from "./compareView";
import { convert, conversionsFor, jsonToXmlProblem, type Conversion } from "./convert";
import { Dropdown, type DropdownItem } from "./dropdown";
import { clampFontSize, gutterChars, lineHeight, panelFontSize, panelRowHeight, zoomFontSize } from "./fontScale";
import { icon, renderIcons } from "./icons";
import { clampPanelWidth, hasMoreMenu, layoutForLevel, MAX_TOOLBAR_LEVEL, panelIsOverlay, toolbarLayout, toolbarLevel, type ToolbarLayout } from "./layout";
import { Tooltips } from "./tooltip";
import { jsonToTree } from "./jsonTree";
import { LANGUAGES, LANG_BY_ID, langDot, languageFromFilename } from "./languages";
import { findOffset, jsonLocations, lineOf, lineStarts, xmlLocations, type Locations } from "./locate";
import { parseJsonLenient } from "./json";
import { renderMarkdown } from "./markdown";
import { SidePanel, type PanelView } from "./panel";
import type { TreeNode } from "./tree";
import { xmlToTree } from "./xmlTree";
import { MAX_HIGHLIGHT_CHARS, renderCode } from "./render";
import { colouredHtml } from "./richCopy";
import { Search } from "./search";
import { activate, activeTab, addTab, closeTab, createTabs, cycle, tabTitle, updateTab, type Tabs } from "./tabs";
import { inlineSqlParams } from "./sqlParams";
import { displayShortcut, isWindows } from "./shortcut";
import { actionApplies, eventToCombo, keyMap, resolveBindings, type ActionId, type Bindings, type KeyOverrides } from "./keymap";
import { KeysEditor } from "./keysEditor";
import { appVersion, checkForUpdate, type UpdateUi } from "./update";
import { saveFilters, suggestFileName, suggestPath, withLineEndings } from "./save";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const ui = {
  lang: $<HTMLButtonElement>("lang"),
  langLabel: $("lang-label"),
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
  btnPanelLabel: $("btn-panel-label"),
  tabbar: $("tabbar"),
  tabsAll: $<HTMLButtonElement>("tabs-all"),
  btnMore: $<HTMLButtonElement>("btn-more"),
  btnView: $<HTMLButtonElement>("btn-view"),
  winMax: $<HTMLButtonElement>("win-max"),
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
  /** Set when the content is the result of a conversion (for the notice and Undo). */
  conversion: ConversionState | null;
  /** Side panel open in this tab. */
  panelOpen: boolean;
}

/** What a tab keeps while it is not the active one. */
interface TabData {
  state: State;
  scrollTop: number;
  scrollLeft: number;
  filter: string;
}

interface ConversionState {
  /** Label of the source language, e.g. "JSON". */
  from: string;
  /** Language of the result. */
  to: string;
  /** Show the result as is, without formatting (minified output). */
  raw: boolean;
  /** The content before the conversion (restored by Undo). */
  previous: Content;
  previousConversion: ConversionState | null;
}

function emptyState(): State {
  return {
    original: null, decoded: null, showOriginal: false, content: null, detection: null,
    lang: "plaintext", shown: "", unescaped: 0, conversion: null, panelOpen: settings.panel,
  };
}

let settings: Settings = { ...backend.DEFAULT_SETTINGS };
const state: State = emptyState();
let tabs: Tabs<TabData> = createTabs(emptyTabData());
let renderToken = 0;
const search = new Search(ui.code, $("searchbar"), $<HTMLInputElement>("search"), $("search-count"));
const panel = new SidePanel();
const historyMenu = new Dropdown($("history-menu"), $("btn-history"));
const convertMenu = new Dropdown($("convert-menu"), $("btn-convert"));
const langMenu = new Dropdown($("lang-menu"), ui.lang);
const tabsMenu = new Dropdown($("tabs-menu"), ui.tabsAll);
const moreMenu = new Dropdown($("more-menu"), ui.btnMore);
const viewMenu = new Dropdown($("view-menu"), ui.btnView);
const copyMenu = new Dropdown($("copy-menu"), $("btn-copy-menu"));
const menus = [historyMenu, convertMenu, langMenu, tabsMenu, moreMenu, viewMenu, copyMenu];
/** Current responsive toolbar state (see layout.ts). */
let layout: ToolbarLayout = toolbarLayout(window.innerWidth);
/** The side panel is an overlay sheet (narrow window); `overlayOpen` is its state. */
let overlay = panelIsOverlay(window.innerWidth);
let overlayOpen = false;
const compareView = new CompareView();

/** Compare mode: `right` is null while waiting for the right side. */
let compare: { left: Content; lang: string; right: Content | null } | null = null;
let compareToken = 0;
let history: HistoryEntry[] = [];
/** The app shortcuts (defaults merged with the user's changes) and combo -> action. */
let bindings: Bindings = resolveBindings({});
let keys = keyMap(bindings);
const keysEditor = new KeysEditor($("keys-editor"), $("keys-status"));

// ------------------------------------------------------------------ setup

renderIcons();
new Tooltips($("tooltip"), "button, .toggle, .tab, .detect", (el, title) => {
  const action = el.dataset.action as ActionId | undefined;
  if (action && el.dataset.label !== undefined) return { label: el.dataset.label, key: keyLabel(action) || undefined };
  return { label: title };
});

async function init() {
  settings = await backend.loadSettings();
  settings.fontSize = clampFontSize(settings.fontSize);
  state.panelOpen = settings.panel;
  applySettings();
  applyLayout();
  window.addEventListener("resize", applyLayout);
  initTitleBar();
  renderTabBar();
  ui.tabbar.addEventListener("click", onTabBarClick);
  ui.tabbar.addEventListener("auxclick", (e) => {
    const id = tabIdOf(e.target);
    if (e.button === 1 && id !== undefined) { e.preventDefault(); closeTabById(id); }
  });
  // Middle-click must not start autoscroll.
  ui.tabbar.addEventListener("mousedown", (e) => { if (e.button === 1) e.preventDefault(); });
  initTabScrolling();
  $("tab-new").addEventListener("click", newTab);
  ui.tabsAll.addEventListener("click", toggleTabsMenu);
  if (settings.history) history = parseHistory(await backend.loadHistory().catch(() => []));

  ui.lang.addEventListener("click", toggleLangMenu);
  ui.btnMore.addEventListener("click", toggleMoreMenu);
  ui.btnView.addEventListener("click", toggleViewMenu);
  $("btn-copy-menu").addEventListener("click", toggleCopyMenu);
  ui.optFormat.addEventListener("change", () => { settings.format = ui.optFormat.checked; persist(); void render(); });
  ui.optWrap.addEventListener("change", () => { settings.wrap = ui.optWrap.checked; persist(); applySettings(); });
  ui.optLines.addEventListener("change", () => { settings.lineNumbers = ui.optLines.checked; persist(); applySettings(); });

  $("btn-history").addEventListener("click", toggleHistoryMenu);
  $("btn-convert").addEventListener("click", toggleConvertMenu);
  $("btn-compare").addEventListener("click", startCompare);
  $("compare-paste").addEventListener("click", pasteFromClipboard);
  $("compare-open").addEventListener("click", openFileDialog);
  $("compare-history").addEventListener("click", () => toggleHistoryMenuAt($("compare-history")));
  $("compare-cancel").addEventListener("click", leaveCompare);
  compareView.onClose = leaveCompare;
  compareView.onOptionsChange = () => void runCompare();
  $("btn-clear-history").addEventListener("click", () => {
    clearHistory();
    toast("History cleared", true);
  });
  $("btn-paste").addEventListener("click", pasteFromClipboard);
  $("btn-open").addEventListener("click", openFileDialog);
  $("btn-copy").addEventListener("click", copyShown);
  $("btn-editor").addEventListener("click", openInEditor);
  $("btn-save").addEventListener("click", saveShown);
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
    toast(what === "path" ? "Copied path" : "Copied value", true);
  };
  ui.settingsForm.addEventListener("submit", onSettingsSubmit);
  for (const tab of ui.settings.querySelectorAll<HTMLElement>(".settings-nav [data-page]")) {
    tab.addEventListener("click", () => showSettingsPage(tab.dataset.page!));
  }
  // Esc while recording a shortcut cancels the recording, not the dialog.
  ui.settings.addEventListener("cancel", (e) => { if (keysEditor.takeEscape()) e.preventDefault(); });
  ui.settings.addEventListener("close", () => keysEditor.stop());

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
  await backend.onFileDrop((path) => void openPath(path), (over) => {
    document.body.classList.toggle("drag-over", over);
    $("drop-overlay").hidden = !over || !!compare;
  });
  await loadPending();
  const scError = await backend.shortcutStatus();
  if (scError && !state.content) {
    ui.shortcutHint.textContent = `${displayShortcut(scError)} Pick another shortcut under Settings.`;
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
      const text = document.createElement("span");
      text.className = "bar-text";
      text.textContent = message;
      bar.replaceChildren();
      bar.insertAdjacentHTML("afterbegin", icon("download"));
      bar.append(text);
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
  if (c) setContent(c, { newTab: settings.newTab });
}

// ------------------------------------------------------------------ content

/**
 * Shows new content. `conversion` is set for the result of a conversion;
 * `record` adds the content to the history (not for conversions and Undo);
 * `newTab` opens it in a new tab unless the current tab is empty.
 */
function setContent(c: Content, opts: { conversion?: ConversionState | null; record?: boolean; newTab?: boolean } = {}) {
  // In compare mode new content becomes the right side.
  if (compare && !opts.conversion) {
    // Decoded and unescaped like the left side (the current content) is.
    const typed = c.name ? (languageFromFilename(c.name) ?? "plaintext") !== "plaintext" : false;
    let text = (c.truncated || typed ? null : decodeText(c.text))?.text ?? c.text;
    text = (c.truncated ? null : unwrapEscapedJson(text))?.text ?? text;
    compare.right = { ...c, text };
    recordHistory(c, detectLanguage(text, c.name).lang);
    void runCompare();
    return;
  }
  if (opts.newTab && state.original) {
    saveActiveTab();
    tabs = addTab(tabs, emptyTabData());
    Object.assign(state, emptyState());
    panel.filterText = "";
  }
  const conversion = opts.conversion ?? null;
  // Encoded text is decoded, unless the file type already says what it is.
  const typed = c.name ? (languageFromFilename(c.name) ?? "plaintext") !== "plaintext" : false;
  state.original = c;
  state.decoded = c.truncated || typed || conversion ? null : decodeText(c.text);
  state.showOriginal = false;
  state.conversion = conversion;
  showContent();
  if (opts.record ?? !conversion) recordHistory(c);
}

// ------------------------------------------------------------------ history

function recordHistory(c: Content, lang = state.detection?.lang ?? "plaintext") {
  if (!settings.history) return;
  const next = addToHistory(history, { text: c.text, name: c.name, lang, time: Date.now() });
  if (next === history) return;
  history = next;
  backend.saveHistory(history).catch((e) => toast(`Could not save the history: ${e}`));
}

function clearHistory() {
  history = [];
  backend.saveHistory([]).catch((e) => toast(`Could not clear the history: ${e}`));
}

/** Opens the history under `anchor`: the History button, or "…" when it is hidden. */
function toggleHistoryMenuAt(anchor?: HTMLElement) {
  const now = Date.now();
  const items: DropdownItem[] = history.map((e) => ({
    label: e.preview || "(empty)",
    mono: true,
    dot: langDot(e.lang),
    meta: [LANG_BY_ID.get(e.lang)?.label ?? e.lang, e.name, relativeTime(e.time, now)].filter(Boolean).join(" · "),
    title: new Date(e.time).toLocaleString(),
    run: () => setContent({ text: e.text, name: e.name }),
  }));
  historyMenu.toggle(items, {
    emptyText: settings.history ? "No history yet." : "History is turned off (Settings).",
    anchor: anchor ?? (layout.moreActions ? ui.btnMore : undefined),
  });
}

function toggleHistoryMenu() {
  toggleHistoryMenuAt();
}

// ------------------------------------------------------------------ compare

/** Ctrl+D: the current content becomes the left side; the next content the right side. */
function startCompare() {
  if (compare) return;
  if (!state.content) { toast("Paste or open something first, then compare it with another snippet."); return; }
  compare = { left: state.content, lang: state.lang, right: null };
  search.close();
  $("compare-prompt").hidden = false;
}

async function runCompare() {
  if (!compare?.right) return;
  const { left, right, lang } = compare;
  const token = ++compareToken;
  $("compare-prompt").hidden = true;
  compareView.open(left.name ?? "Current", right.name ?? (right.text === left.text ? "Same text" : "Pasted text"));
  compareView.showMessage("Comparing…");
  let a = left.text, b = right.text;
  if (!compareView.rawMode) {
    const opts = {
      indent: settings.indent,
      printWidth: 100,
      sqlDialect: settings.sqlDialect as never,
      sqlKeywordCase: settings.sqlKeywordCase,
    };
    [a, b] = await Promise.all([normalizeForCompare(a, lang, opts), normalizeForCompare(b, lang, opts)]);
  }
  if (token !== compareToken || !compare) return;
  compareView.show(diffTexts(a, b, { ignoreWhitespace: compareView.ignoreWhitespace }));
}

function leaveCompare() {
  compare = null;
  compareToken++;
  $("compare-prompt").hidden = true;
  compareView.close();
}

// ------------------------------------------------------------------ conversions

function toggleConvertMenu() {
  const c = state.content;
  if (!c) return;
  const items: DropdownItem[] = conversionsFor(state.lang).map((conv) => {
    // JSON → XML is only offered when the JSON maps cleanly to XML.
    let problem: string | null = null;
    if (conv.id === "json-xml") {
      try {
        problem = jsonToXmlProblem(parseJsonLenient(c.text).value);
      } catch { /* not valid JSON: reported when converting */ }
    }
    return {
      label: conv.label,
      disabled: !!problem,
      title: problem ? `Cannot convert to XML: ${problem}.` : undefined,
      run: () => runConversion(conv),
    };
  });
  convertMenu.toggle(items, { anchor: layout.moreActions ? ui.btnMore : undefined });
}

function runConversion(conv: Conversion) {
  const c = state.content;
  if (!c) return;
  let text: string;
  try {
    text = convert(conv.id, c.text, settings.indent);
  } catch (e) {
    toast(e instanceof Error ? e.message : String(e));
    return;
  }
  const from = LANG_BY_ID.get(state.lang)?.label ?? state.lang;
  const ext = LANG_BY_ID.get(conv.to)?.ext ?? "txt";
  const name = c.name ? c.name.replace(/(\.[^.\\/]*)?$/, `.${ext}`) : undefined;
  setContent(
    { text, name },
    { conversion: { from, to: conv.to, raw: conv.id.endsWith("-min"), previous: state.original!, previousConversion: state.conversion } },
  );
}

function undoConversion() {
  const conv = state.conversion;
  if (!conv) return;
  setContent(conv.previous, { conversion: conv.previousConversion, record: false });
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
  state.detection = state.conversion ? { lang: state.conversion.to, source: "parsed" } : detectLanguage(c.text, c.name);
  state.lang = state.detection.lang;
  updateLangLabel();
  ui.viewer.scrollTo(0, 0);
  updateTitle();
  void render();
}

/** Window title and tab bar for the active tab. */
function updateTitle() {
  const name = state.content?.name;
  void backend.setTitle(name ? `${name} – DocView` : "DocView");
  renderTabBar();
}

// ------------------------------------------------------------------ tabs

function emptyTabData(): TabData {
  return { state: emptyState(), scrollTop: 0, scrollLeft: 0, filter: "" };
}

/** Stores the view state of the active tab. */
function saveActiveTab() {
  tabs = updateTab(tabs, tabs.active, {
    state: { ...state },
    scrollTop: ui.viewer.scrollTop,
    scrollLeft: ui.viewer.scrollLeft,
    filter: panel.filterText,
  });
}

/** Shows the active tab from its stored view state. */
async function restoreActiveTab() {
  const data = activeTab(tabs).data;
  Object.assign(state, data.state);
  panel.filterText = data.filter;
  updateLangLabel();
  updateTitle();
  if (!state.content) { showEmpty(); return; }
  await render();
  ui.viewer.scrollTo(data.scrollLeft, data.scrollTop);
}

function switchTab(id: number) {
  if (id === tabs.active) return;
  if (compare) leaveCompare();
  saveActiveTab();
  tabs = activate(tabs, id);
  void restoreActiveTab();
}

function cycleTab(dir: 1 | -1) {
  if (tabs.tabs.length < 2) return;
  saveActiveTab();
  tabs = cycle(tabs, dir);
  void restoreActiveTab();
}

function newTab() {
  if (compare) leaveCompare();
  saveActiveTab();
  tabs = addTab(tabs, emptyTabData());
  void restoreActiveTab();
}

function closeTabById(id: number) {
  if (compare) leaveCompare();
  const wasActive = id === tabs.active;
  tabs = closeTab(tabs, id, emptyTabData());
  if (wasActive) void restoreActiveTab();
  else renderTabBar();
}

/** The empty start screen (a new or emptied tab). */
function showEmpty() {
  renderToken++;
  state.shown = "";
  ui.code.innerHTML = "";
  ui.code.className = "code";
  document.body.classList.remove("has-content");
  ui.info.textContent = "";
  showDetectSource();
  updateFormatToggle();
  showNotices([]);
  search.refresh();
  updatePanel();
  fitToolbar();
}

function tabIdOf(target: EventTarget | null): number | undefined {
  const el = (target as HTMLElement | null)?.closest<HTMLElement>("[data-tab]");
  return el ? Number(el.dataset.tab) : undefined;
}

function onTabBarClick(e: MouseEvent) {
  if (tabDragged) { tabDragged = false; return; }
  const t = e.target as HTMLElement;
  const id = tabIdOf(t);
  if (id === undefined) return;
  if (t.closest(".tab-close")) closeTabById(id);
  else switchTab(id);
}

/** Language and title of a tab (the active tab's data is in `state`). */
function tabInfo(tab: { id: number; data: TabData }) {
  const s = tab.id === tabs.active ? state : tab.data.state;
  return { content: s.content, lang: s.lang };
}

/** The tab strip in the title bar (always shown, also with one tab). */
function renderTabBar() {
  const bar = ui.tabbar;
  bar.replaceChildren();
  for (const tab of tabs.tabs) {
    const active = tab.id === tabs.active;
    const { content, lang } = tabInfo(tab);
    const el = document.createElement("div");
    el.className = active ? "tab active" : "tab";
    el.dataset.tab = String(tab.id);
    el.title = content?.name ?? tabTitle(content);
    el.setAttribute("role", "tab");
    el.setAttribute("aria-selected", String(active));
    if (content) {
      const dot = document.createElement("span");
      dot.className = "dot";
      dot.style.background = langDot(lang);
      el.append(dot);
    }
    const title = document.createElement("span");
    title.className = "tab-title";
    title.textContent = tabTitle(content);
    const close = document.createElement("button");
    close.type = "button";
    close.className = "tab-close";
    close.title = withKey("Close", "closeTab");
    close.setAttribute("aria-label", "Close tab");
    close.innerHTML = icon("x", 12);
    el.append(title, close);
    bar.append(el);
  }
  updateTabOverflow(true);
}

/** Shows the "all tabs" pill and the edge fades when the tabs do not fit. */
function updateTabOverflow(revealActive = false) {
  const bar = ui.tabbar;
  if (revealActive) {
    const active = bar.querySelector<HTMLElement>(".tab.active");
    if (active) {
      const left = active.offsetLeft - bar.offsetLeft;
      if (left < bar.scrollLeft) bar.scrollLeft = left - 8;
      else if (left + active.offsetWidth > bar.scrollLeft + bar.clientWidth) bar.scrollLeft = left + active.offsetWidth - bar.clientWidth + 8;
    }
  }
  const overflow = bar.scrollWidth > bar.clientWidth + 1;
  bar.classList.toggle("fade-left", overflow && bar.scrollLeft > 1);
  bar.classList.toggle("fade-right", overflow && bar.scrollLeft + bar.clientWidth < bar.scrollWidth - 1);
  ui.tabsAll.hidden = !overflow;
  $("tabs-count").textContent = String(tabs.tabs.length);
}

/** Set when a drag scrolled the strip, so the following click does not switch tabs. */
let tabDragged = false;

/** Wheel and drag scrolling of the tab strip. */
function initTabScrolling() {
  const bar = ui.tabbar;
  bar.addEventListener("wheel", (e) => {
    if (bar.scrollWidth <= bar.clientWidth) return;
    e.preventDefault();
    bar.scrollLeft += Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
  }, { passive: false });
  bar.addEventListener("scroll", () => updateTabOverflow());
  bar.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || !(e.target as HTMLElement).closest(".tab") || bar.scrollWidth <= bar.clientWidth) return;
    const startX = e.clientX;
    const startScroll = bar.scrollLeft;
    let dragging = false;
    const move = (ev: PointerEvent) => {
      if (!dragging && Math.abs(ev.clientX - startX) > 6) {
        dragging = true;
        bar.setPointerCapture(ev.pointerId);
      }
      if (dragging) bar.scrollLeft = startScroll - (ev.clientX - startX);
    };
    const up = () => {
      bar.removeEventListener("pointermove", move);
      bar.removeEventListener("pointerup", up);
      bar.removeEventListener("pointercancel", up);
      tabDragged = dragging;
    };
    bar.addEventListener("pointermove", move);
    bar.addEventListener("pointerup", up);
    bar.addEventListener("pointercancel", up);
  });
  new ResizeObserver(() => updateTabOverflow()).observe(bar);
}

function toggleTabsMenu() {
  const items: DropdownItem[] = tabs.tabs.map((tab) => {
    const { content, lang } = tabInfo(tab);
    return {
      label: tabTitle(content),
      meta: content ? LANG_BY_ID.get(lang)?.label ?? lang : undefined,
      dot: content ? langDot(lang) : "var(--color-neutral-300)",
      selected: tab.id === tabs.active,
      title: content?.name,
      run: () => switchTab(tab.id),
    };
  });
  tabsMenu.toggle(items);
}

// ------------------------------------------------------------------ title bar

function initTitleBar() {
  $("win-min").addEventListener("click", () => void backend.minimizeWindow());
  ui.winMax.addEventListener("click", () => void backend.toggleMaximizeWindow());
  $("win-close").addEventListener("click", () => void backend.closeWindow());
  const syncMaximized = async () => {
    const max = await backend.isMaximized();
    ui.winMax.innerHTML = icon(max ? "restore" : "square", 15);
    ui.winMax.title = max ? "Restore" : "Maximise";
    ui.winMax.setAttribute("aria-label", ui.winMax.title);
  };
  void syncMaximized();
  void backend.onWindowResized(() => void syncMaximized());
}

/** Native window frame ("Use system title bar") or DocView's own title bar. */
function applyFrame() {
  const native = settings.systemTitleBar;
  document.body.classList.toggle("native-frame", native);
  // With the native frame the tab row is ordinary content, not a drag area.
  for (const el of document.querySelectorAll<HTMLElement>("#titlebar, #titlebar .logo, #tabbar, #titlebar .drag-space")) {
    if (native) el.removeAttribute("data-tauri-drag-region");
    else el.setAttribute("data-tauri-drag-region", "");
  }
}

// ------------------------------------------------------------------ toolbar

/** Applies the responsive toolbar and panel rules for the current window width. */
function applyLayout() {
  const w = window.innerWidth;
  fitToolbar();
  fitPanelWidth();
  const wasOverlay = overlay;
  overlay = panelIsOverlay(w);
  if (overlay !== wasOverlay) {
    overlayOpen = false;
    updatePanel();
  }
  updateTabOverflow();
}

/** The stored panel width, limited so the code keeps its minimum width. */
function fitPanelWidth() {
  panel.setWidth(clampPanelWidth(settings.panelWidth, $("workspace").clientWidth || window.innerWidth - 32));
}

/** Collapses the toolbar for the window width (see layout.ts). */
function fitToolbar() {
  const w = window.innerWidth;
  // The breakpoints are the minimum; with wider labels (fonts, scaling) the
  // next steps also apply until the toolbar fits.
  const bar = $("toolbar");
  for (let level = toolbarLevel(w); level <= MAX_TOOLBAR_LEVEL; level++) {
    setToolbarLayout(layoutForLevel(level));
    if (bar.scrollWidth <= bar.clientWidth + 1) break;
  }
}

function setToolbarLayout(l: ToolbarLayout) {
  layout = l;
  const b = document.body.classList;
  b.toggle("tb-hide-count", l.hideLineCount);
  b.toggle("tb-compact", l.compact);
  b.toggle("tb-more-actions", l.moreActions);
  b.toggle("tb-more-copy", l.moreCopy);
  b.toggle("tb-view", l.viewMenu);
  b.toggle("tb-more-open", l.moreOpen);
  ui.btnMore.hidden = !hasMoreMenu(l);
  ui.btnView.hidden = !l.viewMenu;
}

function updateLangLabel() {
  ui.langLabel.textContent = LANG_BY_ID.get(state.lang)?.label ?? state.lang;
}

function toggleLangMenu() {
  const items: DropdownItem[] = LANGUAGES.map((l) => ({
    label: l.label,
    dot: langDot(l.id),
    selected: l.id === state.lang,
    run: () => {
      if (l.id === state.lang) return;
      state.lang = l.id;
      updateLangLabel();
      renderTabBar();
      void render();
    },
  }));
  langMenu.toggle(items, { search: "Search languages" });
}

/** The "…" menu: actions that do not fit in the toolbar, with their shortcuts. */
function toggleMoreMenu() {
  const items: DropdownItem[] = [];
  const add = (label: string, ic: DropdownItem["icon"], action: ActionId | null, run: () => void, disabled = false) =>
    items.push({ label, icon: ic, key: action ? keyLabel(action) || undefined : undefined, run, disabled });
  if (layout.moreActions) {
    add("History", "history", "history", () => toggleHistoryMenuAt(ui.btnMore));
    add("Compare", "compare", "compare", startCompare);
    if (backend.isTauri) add("Editor", "editor", "editor", () => void openInEditor());
    add("Save…", "save", "save", () => void saveShown());
    if (conversionsFor(state.lang).length && state.content) add("Convert…", "file", null, toggleConvertMenu);
  }
  if (layout.moreCopy) {
    add("Copy", "copy", "copy", () => void copyShown());
    add("Copy colours", "palette", "copyRich", () => void copyColoured());
  }
  if (layout.moreOpen) add("Open…", "folder", "open", () => void openFileDialog());
  const heading = layout.hideLineCount && ui.info.textContent ? ui.info.textContent : undefined;
  moreMenu.toggle(items, { heading });
}

/** The "View ▾" menu (narrow windows): Format, Wrap and Line no. */
function toggleViewMenu() {
  const opt = (label: string, input: HTMLInputElement, action: ActionId): DropdownItem => ({
    label,
    checked: input.checked,
    disabled: input.disabled,
    title: input.disabled ? input.closest<HTMLElement>(".toggle")?.dataset.tipTitle ?? input.closest<HTMLElement>(".toggle")?.title : undefined,
    key: keyLabel(action) || undefined,
    run: () => input.click(),
  });
  viewMenu.toggle([opt("Format", ui.optFormat, "format"), opt("Wrap", ui.optWrap, "wrap"), opt("Line no.", ui.optLines, "lineNumbers")]);
}

function toggleCopyMenu() {
  copyMenu.toggle([
    { label: "Copy", icon: "copy", key: keyLabel("copy") || undefined, run: () => void copyShown() },
    { label: "Copy colours", icon: "palette", key: keyLabel("copyRich") || undefined, title: "For pasting into Outlook, Teams or Word", run: () => void copyColoured() },
  ]);
}

async function render() {
  const c = state.content;
  if (!c) return;
  const token = ++renderToken;
  const lang = state.lang;
  const notices: Notice[] = [];
  if (c.truncated) notices.push({ text: "The file is large – only the beginning is shown.", tone: "warn" });
  if (state.conversion) notices.push({ text: `Converted from ${state.conversion.from} –`, icon: "check", action: { label: "Undo", run: undoConversion } });
  const dec = state.decoded;
  if (dec) {
    const label = ENCODING_LABEL[dec.kind];
    const k = keyLabel("decoded");
    const toOriginal = k ? undefined : { label: "Show original", run: toggleDecoded };
    if (state.showOriginal) {
      notices.push(k ? { text: `Showing the original ${label} – press ${k} to decode.` }
        : { text: `Showing the original ${label} –`, action: { label: "Decode", run: toggleDecoded } });
    } else if (dec.kind === "jwt" && dec.payload) {
      const tone = jwtExpired(dec.payload) ? "warn" : undefined;
      notices.push({ text: `${jwtSummary(dec.payload)}${k ? ` Press ${k} to show the original.` : ""}`, action: toOriginal, tone });
    } else {
      notices.push({ text: `Decoded from ${label}${k ? ` – press ${k} to show the original.` : " –"}`, action: toOriginal });
    }
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
  if (settings.format && FORMATTABLE.has(lang) && !state.conversion?.raw) {
    const r = await formatCode(text, lang, {
      indent: settings.indent,
      printWidth: 100,
      sqlDialect: settings.sqlDialect as never,
      sqlKeywordCase: settings.sqlKeywordCase,
    });
    if (token !== renderToken) return; // a newer render started meanwhile
    text = r.text;
    if (r.warning) notices.push({ text: r.warning, tone: "warn" });
    if (r.error) notices.push({ text: `Could not format as ${LANG_BY_ID.get(lang)?.label}: ${r.error}`, tone: "warn" });
  }
  if (text.length > MAX_HIGHLIGHT_CHARS) notices.push({ text: "The text is very large – highlighting is turned off.", tone: "warn" });

  state.shown = text;
  ui.code.className = `code language-${lang}`;
  ui.code.innerHTML = renderCode(text, lang);
  document.body.classList.add("has-content");
  $("drop-overlay").hidden = true;

  showDetectSource();
  const lines = text.split("\n").length;
  ui.code.style.setProperty("--gutter", String(gutterChars(lines)));
  ui.info.textContent = `${c.name ? c.name + " · " : ""}${lines} line${lines === 1 ? "" : "s"}`;
  showNotices(notices);
  updateFormatToggle();
  search.refresh();
  updatePanel();
  fitToolbar();
}

interface Notice {
  text: string;
  action?: { label: string; run: () => void };
  /** Warnings and errors are terracotta; the rest is informational (sage). */
  tone?: "warn";
  icon?: "check";
}

/** Notice bars at the top of the code card (several can show at once). */
function showNotices(notices: Notice[]) {
  ui.notice.replaceChildren();
  for (const n of notices) {
    const item = document.createElement("div");
    item.className = n.tone === "warn" ? "notice warn" : "notice";
    item.innerHTML = icon(n.icon ?? (n.tone === "warn" ? "alert" : "info"));
    const text = document.createElement("span");
    text.className = "notice-text";
    text.textContent = n.text;
    item.append(text);
    if (n.action) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = n.action.label;
      b.addEventListener("click", n.action.run);
      item.append(b);
    }
    ui.notice.append(item);
  }
  ui.notice.hidden = notices.length === 0;
}

/** How the language was found: recognized, file type, guess; nothing when picked by hand. */
function showDetectSource() {
  const el = ui.detectSource;
  const src = state.detection?.source;
  el.className = "detect";
  el.replaceChildren();
  el.removeAttribute("title");
  if (!state.content || state.lang !== state.detection?.lang) return;
  const [cls, ic, label, tip] = src === "file"
    ? ["file", "file", "file type", "Recognized from the file type"] as const
    : src === "parsed"
      ? ["recognized", "check", "recognized", "Recognized from the content"] as const
      : ["guess", "help", "guess", "A guess – pick the language if it is wrong"] as const;
  el.classList.add(cls);
  el.title = tip;
  el.insertAdjacentHTML("beforeend", icon(ic, 13));
  const span = document.createElement("span");
  span.className = "lbl";
  span.textContent = label;
  el.append(span);
}

/** Format is unavailable (dimmed) for languages without a formatter. */
function updateFormatToggle() {
  const label = ui.optFormat.closest<HTMLElement>(".toggle")!;
  const na = !!state.content && !FORMATTABLE.has(state.lang);
  ui.optFormat.disabled = na;
  label.dataset.label = na ? `No formatter for ${LANG_BY_ID.get(state.lang)?.label ?? state.lang}` : "Format the code";
  label.title = na ? label.dataset.label : withKey(label.dataset.label, "format");
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
    json: (t) => jsonToTree(parseJsonLenient(t).value, settings.indent),
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
  ($("btn-convert") as HTMLButtonElement).hidden = conversionsFor(state.lang).length === 0;
  const view = panelView();
  ui.btnPanel.hidden = !view;
  ui.btnPanelLabel.textContent = view?.html !== undefined ? "Preview" : view?.table ? "Table" : "Tree";
  ui.btnPanel.dataset.label = view?.html !== undefined ? "Show Markdown preview" : view?.table ? "Show table view" : "Show tree view";
  ui.btnPanel.dataset.action = "panel";
  ui.btnPanel.title = withKey(ui.btnPanel.dataset.label, "panel");
  // In a narrow window the panel is an overlay sheet that starts closed.
  const open = overlay ? overlayOpen : state.panelOpen;
  ui.btnPanel.classList.toggle("active", !!view && open);
  document.body.classList.toggle("panel-overlay", overlay);
  panel.update(view, open);
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
  if (overlay) {
    overlayOpen = !overlayOpen;
    updatePanel();
    if (overlayOpen) panel.tree.focus();
    return;
  }
  // Per tab; the last choice is also the default for new tabs.
  state.panelOpen = settings.panel = !state.panelOpen;
  persist();
  updatePanel();
  if (state.panelOpen) panel.tree.focus();
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
      if (f) setContent({ text: await f.text(), name: f.name }, { newTab: settings.newTab });
    };
    input.click();
    return;
  }
  const path = await backend.pickFile();
  if (path) await openPath(path);
}

async function openPath(path: string) {
  try {
    setContent(await backend.readFile(path), { newTab: settings.newTab });
  } catch (e) {
    toast(`Could not open the file: ${e}`);
  }
}

async function copyShown() {
  if (!state.content) return;
  await backend.writeClipboard(state.shown);
  toast("Copied", true);
}

/** Copies the shown text as highlighted HTML (light theme, inline styles) plus plain text. */
async function copyColoured() {
  if (!state.content) return;
  try {
    await backend.writeClipboardHtml(colouredHtml(state.shown, state.lang), state.shown);
    toast("Copied with colours", true);
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

/** Saves the shown text (as formatted, decoded or converted – the same as Copy) to a file. */
async function saveShown() {
  if (!state.content) { toast("Nothing to save – paste or open something first."); return; }
  const c = state.content;
  const text = withLineEndings(state.shown, isWindows);
  if (!backend.isTauri) {
    backend.downloadText(suggestFileName(c.name, state.lang), text);
    return;
  }
  try {
    const path = await backend.pickSavePath(suggestPath(c.path, c.name, state.lang), saveFilters(state.lang));
    if (!path) return;
    await backend.writeFile(path, text);
    toast(`Saved ${path.split(/[\\/]/).pop()}`, true);
  } catch (e) {
    toast(`Could not save the file: ${e}`);
  }
}

/** Switches between the decoded text and the original (D). */
function toggleDecoded() {
  if (!state.decoded) return;
  state.showOriginal = !state.showOriginal;
  showContent();
}

function zoom(delta: number) {
  settings.fontSize = zoomFontSize(settings.fontSize, delta);
  applySettings();
  persist();
}

// ------------------------------------------------------------------ settings

function applySettings() {
  const root = document.documentElement;
  if (settings.theme === "auto") delete root.dataset.theme;
  else root.dataset.theme = settings.theme;
  const size = clampFontSize(settings.fontSize);
  root.style.setProperty("--code-size", `${size}px`);
  root.style.setProperty("--code-lh", `${lineHeight(size)}px`);
  root.style.setProperty("--panel-size", `${panelFontSize(size)}px`);
  root.style.setProperty("--panel-row-h", `${panelRowHeight(size)}px`);
  applyFrame();
  fitPanelWidth();
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
  applyKeys();
}

/** Rebuilds the shortcut table and the shortcuts shown in tooltips and hints. */
function applyKeys() {
  bindings = resolveBindings(settings.keys);
  keys = keyMap(bindings);
  for (const el of document.querySelectorAll<HTMLElement>("[data-action]")) {
    el.dataset.label ??= el.title;
    el.title = withKey(el.dataset.label, el.dataset.action as ActionId);
  }
  for (const el of document.querySelectorAll<HTMLElement>("[data-key]")) {
    el.textContent = keyLabel(el.dataset.key as ActionId);
  }
  $("open-hint").hidden = !bindings.open;
}

/** The shortcut of an action as shown to the user ("" when it has none). */
function keyLabel(id: ActionId): string {
  return displayShortcut(bindings[id]);
}

/** "Label (shortcut)", or just the label when the action has no shortcut. */
function withKey(label: string, id: ActionId): string {
  const k = keyLabel(id);
  return k ? `${label} (${k})` : label;
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
  keysEditor.load(validKeys(settings.keys), settings.shortcut, backend.DEFAULT_SETTINGS.shortcut);
  ui.settingsError.textContent = "";
  ui.settingsToast.hidden = true;
  showSettingsPage("general");
  ui.settings.showModal();
}

function validKeys(k: unknown): KeyOverrides {
  return k && typeof k === "object" && !Array.isArray(k) ? (k as KeyOverrides) : {};
}

function showSettingsPage(page: string) {
  for (const el of ui.settings.querySelectorAll<HTMLElement>("[data-page]")) {
    const on = el.dataset.page === page;
    if (el.getAttribute("role") === "tab") el.setAttribute("aria-selected", String(on));
    else el.hidden = !on;
  }
}

async function onSettingsSubmit(e: SubmitEvent) {
  const submitter = e.submitter as HTMLButtonElement | null;
  if (submitter?.value !== "save") return;
  e.preventDefault();
  const f = ui.settingsForm.elements as unknown as Record<string, HTMLInputElement>;
  const next: Settings = {
    ...settings,
    shortcut: keysEditor.global || backend.DEFAULT_SETTINGS.shortcut,
    keys: keysEditor.keys as Record<string, string>,
    theme: f.theme.value as Settings["theme"],
    fontSize: clampFontSize(Number(f.fontSize.value) || undefined),
    systemTitleBar: f.systemTitleBar.checked,
    indent: Number(f.indent.value) || 2,
    sqlDialect: f.sqlDialect.value,
    sqlKeywordCase: f.sqlKeywordCase.value as Settings["sqlKeywordCase"],
    editorPath: f.editorPath.value.trim(),
    autostart: f.autostart.checked,
    autoUpdate: f.autoUpdate.checked,
    history: f.history.checked,
    newTab: f.newTab.value === "true",
  };
  try {
    await backend.saveSettings(next);
  } catch (err) {
    ui.settingsError.textContent = displayShortcut(String(err));
    // Most likely the global shortcut could not be registered.
    if (/shortcut/i.test(String(err))) showSettingsPage("shortcuts");
    return;
  }
  // Turning history off also removes what was stored.
  if (settings.history && !next.history) clearHistory();
  if (next.systemTitleBar !== settings.systemTitleBar) {
    backend.setDecorations(next.systemTitleBar).catch((err) => toast(`Could not change the title bar: ${err}`));
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

  // Esc is fixed: it closes whatever is open, otherwise hides the window.
  if (e.key === "Escape") {
    const menu = menus.find((m) => m.isOpen);
    if (menu) menu.close();
    else if (overlay && overlayOpen) togglePanel();
    else if (compare) leaveCompare();
    else if (search.isOpen) search.close();
    else void backend.hideWindow();
    return;
  }
  const combo = eventToCombo(e);
  const action = combo ? keys.get(combo) : undefined;
  if (!combo || !action) return;
  if (!actionApplies(action, combo, { comparing: !!compare, inInput: isEditable(e.target) })) return;
  // Ctrl+V is left to the normal paste event (it also covers Shift+Insert and the context menu).
  if (action === "paste" && combo === "Ctrl+V") return;
  e.preventDefault();
  ACTION_RUN[action]();
}

const ACTION_RUN: Record<ActionId, () => void> = {
  paste: () => void pasteFromClipboard(),
  open: () => void openFileDialog(),
  save: () => void saveShown(),
  history: toggleHistoryMenu,
  editor: () => void openInEditor(),
  copy: () => void copyShown(),
  copyRich: () => void copyColoured(),
  format: () => ui.optFormat.click(),
  wrap: () => ui.optWrap.click(),
  lineNumbers: () => ui.optLines.click(),
  panel: togglePanel,
  decoded: toggleDecoded,
  zoomIn: () => zoom(1),
  zoomOut: () => zoom(-1),
  zoomReset: () => zoom(0),
  settings: openSettings,
  newTab,
  closeTab: () => closeTabById(tabs.active),
  nextTab: () => cycleTab(1),
  prevTab: () => cycleTab(-1),
  find: () => search.open(),
  findNext: () => search.step(1),
  findPrev: () => search.step(-1),
  compare: startCompare,
  compareNext: () => compareView.step(1),
  comparePrev: () => compareView.step(-1),
};

// ------------------------------------------------------------------ misc

let toastTimer: number | undefined;
/** Shows a short message; `ok` adds a check mark (something succeeded). */
function toast(msg: string, ok = false) {
  // The modal settings dialog covers the normal toast, so show it in the dialog instead.
  const el = ui.settings.open ? ui.settingsToast : ui.toast;
  el.textContent = msg;
  if (ok && el === ui.toast) el.insertAdjacentHTML("afterbegin", icon("check"));
  el.hidden = true;
  void el.offsetWidth; // restart the fade-in
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (el.hidden = true), el === ui.toast ? 2200 : 5000);
}

void init();
