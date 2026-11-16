// Bridge to the Rust side. When run in a normal browser (npm run dev without
// Tauri) the functions degrade gracefully so the viewer can still be used.

export interface Settings {
  shortcut: string;
  theme: "auto" | "light" | "dark";
  fontSize: number;
  wrap: boolean;
  lineNumbers: boolean;
  format: boolean;
  sqlDialect: string;
  sqlKeywordCase: "preserve" | "upper" | "lower";
  indent: number;
  editorPath: string;
  autostart: boolean;
  autoUpdate: boolean;
  /** Side panel (tree view) shown when the content supports it. */
  panel: boolean;
  panelWidth: number;
  /** Selecting a tree node scrolls the code view to its line. */
  panelSync: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  shortcut: "Super+Alt+V",
  theme: "auto",
  fontSize: 14,
  wrap: false,
  lineNumbers: true,
  format: true,
  sqlDialect: "transactsql",
  sqlKeywordCase: "preserve",
  indent: 2,
  editorPath: "",
  autostart: false,
  autoUpdate: true,
  panel: true,
  panelWidth: 380,
  panelSync: true,
};

export interface Content {
  text: string;
  name?: string;
  path?: string;
  truncated?: boolean;
}

export const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const core = await import("@tauri-apps/api/core");
  return core.invoke<T>(cmd, args);
}

export async function loadSettings(): Promise<Settings> {
  if (!isTauri) {
    try {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem("docview.settings") ?? "{}") };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }
  return { ...DEFAULT_SETTINGS, ...(await invoke<Partial<Settings>>("get_settings")) };
}

/** Saves settings; rejects with a message if e.g. the shortcut cannot be registered. */
export async function saveSettings(s: Settings): Promise<void> {
  if (!isTauri) {
    try { localStorage.setItem("docview.settings", JSON.stringify(s)); } catch { /* ignore */ }
    return;
  }
  await invoke("save_settings", { settings: s });
  const autostart = await import("@tauri-apps/plugin-autostart");
  const enabled = await autostart.isEnabled();
  if (s.autostart && !enabled) await autostart.enable();
  if (!s.autostart && enabled) await autostart.disable();
}

/** Content waiting from the backend (clipboard via shortcut, file from argv, …). */
export async function takePending(): Promise<Content | null> {
  if (!isTauri) return null;
  return invoke<Content | null>("take_pending");
}

export async function onPending(cb: () => void): Promise<void> {
  if (!isTauri) return;
  const { listen } = await import("@tauri-apps/api/event");
  await listen("content-pending", cb);
}

export async function onMenu(cb: (action: string) => void): Promise<void> {
  if (!isTauri) return;
  const { listen } = await import("@tauri-apps/api/event");
  await listen<string>("menu", (e) => cb(e.payload));
}

export async function readFile(path: string): Promise<Content> {
  return invoke<Content>("read_file", { path });
}

export async function pickFile(): Promise<string | null> {
  if (!isTauri) return null;
  const { open } = await import("@tauri-apps/plugin-dialog");
  const res = await open({ multiple: false, directory: false });
  return typeof res === "string" ? res : null;
}

export async function onFileDrop(cb: (path: string) => void): Promise<void> {
  if (!isTauri) return;
  const { getCurrentWebview } = await import("@tauri-apps/api/webview");
  await getCurrentWebview().onDragDropEvent((e) => {
    if (e.payload.type === "drop" && e.payload.paths.length) cb(e.payload.paths[0]);
  });
}

export async function readClipboard(): Promise<string> {
  if (isTauri) {
    const { readText } = await import("@tauri-apps/plugin-clipboard-manager");
    return (await readText()) ?? "";
  }
  return navigator.clipboard.readText();
}

export async function writeClipboard(text: string): Promise<void> {
  if (isTauri) {
    const { writeText } = await import("@tauri-apps/plugin-clipboard-manager");
    return writeText(text);
  }
  return navigator.clipboard.writeText(text);
}

export async function openInEditor(text: string, ext: string, path?: string): Promise<void> {
  return invoke("open_in_editor", { text, ext, path: path ?? null });
}

/** Opens an http(s)/mailto link in the default browser / mail client. */
export async function openUrl(url: string): Promise<void> {
  if (!isTauri) {
    window.open(url, "_blank", "noopener");
    return;
  }
  return invoke("open_url", { url });
}

export async function hideWindow(): Promise<void> {
  if (!isTauri) return;
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  await getCurrentWindow().hide();
}

export async function setTitle(title: string): Promise<void> {
  document.title = title;
  if (!isTauri) return;
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  await getCurrentWindow().setTitle(title);
}

/** Error message if the global shortcut could not be registered, else null. */
export async function shortcutStatus(): Promise<string | null> {
  if (!isTauri) return null;
  return invoke<string | null>("shortcut_status");
}
