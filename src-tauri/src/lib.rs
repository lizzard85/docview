// DocView – native shell: tray icon, global shortcut, single instance,
// command-line/file handling and a few commands for the UI.

use std::fs::{self, File};
use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager, State, WindowEvent};
use tauri_plugin_autostart::MacosLauncher;
use tauri_plugin_clipboard_manager::ClipboardExt;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

const DEFAULT_SHORTCUT: &str = "Super+Alt+V";
const MAX_FILE_BYTES: u64 = 20 * 1024 * 1024;

#[derive(Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
struct Content {
    text: String,
    name: Option<String>,
    path: Option<String>,
    truncated: bool,
}

#[derive(Default)]
struct AppState {
    pending: Mutex<Option<Content>>,
    settings: Mutex<Value>,
    shortcut: Mutex<Option<String>>,
    shortcut_error: Mutex<Option<String>>,
}

// ------------------------------------------------------------------ helpers

fn show_main(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.unminimize();
        let _ = w.show();
        let _ = w.set_focus();
    }
}

/// Hands content to the UI. It is parked in state and fetched by the UI
/// (`take_pending`), so nothing is lost if the UI is still loading.
fn deliver(app: &AppHandle, content: Content) {
    *app.state::<AppState>().pending.lock().unwrap() = Some(content);
    let _ = app.emit("content-pending", ());
    show_main(app);
}

fn show_clipboard(app: &AppHandle) {
    match app.clipboard().read_text() {
        Ok(text) if !text.trim().is_empty() => deliver(app, Content { text, ..Default::default() }),
        _ => show_main(app),
    }
}

fn decode(bytes: &[u8]) -> Result<String, String> {
    if let Some(rest) = bytes.strip_prefix(&[0xEF, 0xBB, 0xBF]) {
        return Ok(String::from_utf8_lossy(rest).into_owned());
    }
    let utf16 = |rest: &[u8], le: bool| {
        let units: Vec<u16> = rest
            .chunks_exact(2)
            .map(|c| if le { u16::from_le_bytes([c[0], c[1]]) } else { u16::from_be_bytes([c[0], c[1]]) })
            .collect();
        String::from_utf16_lossy(&units)
    };
    if let Some(rest) = bytes.strip_prefix(&[0xFF, 0xFE]) {
        return Ok(utf16(rest, true));
    }
    if let Some(rest) = bytes.strip_prefix(&[0xFE, 0xFF]) {
        return Ok(utf16(rest, false));
    }
    let sample = &bytes[..bytes.len().min(8192)];
    if sample.iter().filter(|&&b| b == 0).count() > sample.len() / 100 + 1 {
        return Err("The file looks like a binary file".into());
    }
    match std::str::from_utf8(bytes) {
        Ok(s) => Ok(s.to_owned()),
        // A cut-off multi-byte character at the end of a truncated file.
        Err(e) if e.error_len().is_none() => Ok(String::from_utf8_lossy(&bytes[..e.valid_up_to()]).into_owned()),
        // Not UTF-8: treat as Latin-1 / Windows-1252 (keeps æøå readable).
        Err(_) => Ok(bytes.iter().map(|&b| b as char).collect()),
    }
}

fn load_file(path: &Path) -> Result<Content, String> {
    let file = File::open(path).map_err(|e| format!("{}: {e}", path.display()))?;
    let size = file.metadata().map(|m| m.len()).unwrap_or(0);
    let mut bytes = Vec::new();
    file.take(MAX_FILE_BYTES).read_to_end(&mut bytes).map_err(|e| e.to_string())?;
    Ok(Content {
        text: decode(&bytes)?,
        name: path.file_name().map(|n| n.to_string_lossy().into_owned()),
        path: Some(path.to_string_lossy().into_owned()),
        truncated: size > MAX_FILE_BYTES,
    })
}

/// Handles command-line arguments, both at start-up and when a second
/// instance is launched (single-instance forwards its argv here).
fn handle_args(app: &AppHandle, args: &[String], cwd: &Path, first_launch: bool) {
    let mut clipboard = false;
    let mut background = false;
    let mut file: Option<PathBuf> = None;
    for a in args.iter().skip(1) {
        match a.as_str() {
            "--clipboard" | "-c" => clipboard = true,
            "--background" | "--hidden" => background = true,
            s if s.starts_with('-') => {}
            s => {
                let p = PathBuf::from(s);
                file = Some(if p.is_absolute() { p } else { cwd.join(p) });
            }
        }
    }
    if let Some(path) = file {
        match load_file(&path) {
            Ok(c) => deliver(app, c),
            Err(e) => deliver(app, Content { text: format!("Could not open the file:\n{e}"), ..Default::default() }),
        }
    } else if clipboard {
        show_clipboard(app);
    } else if !(background && first_launch) {
        if !background {
            show_main(app);
        }
    }
}

// ------------------------------------------------------------------ settings

fn settings_path(app: &AppHandle) -> Option<PathBuf> {
    app.path().app_config_dir().ok().map(|d| d.join("settings.json"))
}

fn load_settings(app: &AppHandle) -> Value {
    settings_path(app)
        .and_then(|p| fs::read_to_string(p).ok())
        .and_then(|s| serde_json::from_str::<Value>(&s).ok())
        .filter(Value::is_object)
        .unwrap_or_else(|| json!({}))
}

fn shortcut_of(settings: &Value) -> String {
    settings
        .get("shortcut")
        .and_then(Value::as_str)
        .filter(|s| !s.trim().is_empty())
        .unwrap_or(DEFAULT_SHORTCUT)
        .to_string()
}

/// Replaces the registered global shortcut. On failure the old one is kept.
fn register_shortcut(app: &AppHandle, shortcut: &str) -> Result<(), String> {
    let state = app.state::<AppState>();
    let mut current = state.shortcut.lock().unwrap();
    if current.as_deref() == Some(shortcut) {
        return Ok(());
    }
    let gs = app.global_shortcut();
    if let Some(old) = current.as_deref() {
        let _ = gs.unregister(old);
    }
    match gs.register(shortcut) {
        Ok(()) => {
            *current = Some(shortcut.to_string());
            *state.shortcut_error.lock().unwrap() = None;
            Ok(())
        }
        Err(e) => {
            if let Some(old) = current.as_deref() {
                let _ = gs.register(old);
            }
            let msg = format!("The shortcut \"{shortcut}\" could not be registered ({e}). Another program may be using it.");
            *state.shortcut_error.lock().unwrap() = Some(msg.clone());
            Err(msg)
        }
    }
}

// ------------------------------------------------------------------ history

/// Upper limit for history.json; the UI keeps it well below (about 10 MB).
const MAX_HISTORY_BYTES: usize = 16 * 1024 * 1024;

fn history_path(app: &AppHandle) -> Option<PathBuf> {
    app.path().app_config_dir().ok().map(|d| d.join("history.json"))
}

// ------------------------------------------------------------------ commands

#[tauri::command]
fn take_pending(state: State<AppState>) -> Option<Content> {
    state.pending.lock().unwrap().take()
}

#[tauri::command]
fn read_file(path: String) -> Result<Content, String> {
    load_file(Path::new(&path))
}

#[tauri::command]
fn write_file(path: String, text: String) -> Result<(), String> {
    fs::write(&path, text).map_err(|e| format!("{path}: {e}"))
}

#[tauri::command]
fn get_settings(state: State<AppState>) -> Value {
    state.settings.lock().unwrap().clone()
}

#[tauri::command]
fn shortcut_status(state: State<AppState>) -> Option<String> {
    state.shortcut_error.lock().unwrap().clone()
}

#[tauri::command]
fn save_settings(app: AppHandle, state: State<AppState>, settings: Value) -> Result<(), String> {
    if !settings.is_object() {
        return Err("Invalid settings".into());
    }
    register_shortcut(&app, &shortcut_of(&settings))?;
    let path = settings_path(&app).ok_or("No config directory")?;
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    }
    let text = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    fs::write(&path, text).map_err(|e| e.to_string())?;
    *state.settings.lock().unwrap() = settings;
    Ok(())
}

#[tauri::command]
fn load_history(app: AppHandle) -> Value {
    history_path(&app)
        .and_then(|p| fs::read_to_string(p).ok())
        .and_then(|s| serde_json::from_str::<Value>(&s).ok())
        .filter(Value::is_array)
        .unwrap_or_else(|| json!([]))
}

/// Writes the history (a JSON array). An empty array deletes the file.
#[tauri::command]
fn save_history(app: AppHandle, history: Value) -> Result<(), String> {
    let entries = history.as_array().ok_or("Invalid history")?;
    let path = history_path(&app).ok_or("No config directory")?;
    if entries.is_empty() {
        return match fs::remove_file(&path) {
            Err(e) if e.kind() != std::io::ErrorKind::NotFound => Err(e.to_string()),
            _ => Ok(()),
        };
    }
    let text = serde_json::to_string(&history).map_err(|e| e.to_string())?;
    if text.len() > MAX_HISTORY_BYTES {
        return Err("The history is too large".into());
    }
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    }
    // Write to a temporary file first so a crash never leaves a half-written history.
    let tmp = path.with_extension("json.tmp");
    fs::write(&tmp, text).map_err(|e| e.to_string())?;
    fs::rename(&tmp, &path).map_err(|e| e.to_string())
}

#[tauri::command]
fn open_in_editor(state: State<AppState>, text: String, ext: String, path: Option<String>) -> Result<(), String> {
    let target = match path {
        Some(p) => PathBuf::from(p),
        None => {
            let dir = std::env::temp_dir().join("docview");
            fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
            let stamp = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_millis())
                .unwrap_or(0);
            let ext: String = ext.chars().filter(|c| c.is_ascii_alphanumeric()).collect();
            let file = dir.join(format!("snippet-{stamp}.{}", if ext.is_empty() { "txt" } else { &ext }));
            fs::write(&file, text).map_err(|e| e.to_string())?;
            file
        }
    };

    let configured = state
        .settings
        .lock()
        .unwrap()
        .get("editorPath")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(String::from);

    let mut cmd = match configured {
        Some(editor) => {
            let mut c = Command::new(editor);
            c.arg(&target);
            c
        }
        None => default_editor(&target),
    };
    cmd.spawn().map(|_| ()).map_err(|e| e.to_string())
}

#[cfg(target_os = "windows")]
fn default_editor(target: &Path) -> Command {
    let candidates = [
        std::env::var("ProgramFiles").ok().map(|p| PathBuf::from(p).join("Notepad++\\notepad++.exe")),
        std::env::var("ProgramFiles(x86)").ok().map(|p| PathBuf::from(p).join("Notepad++\\notepad++.exe")),
    ];
    let exe = candidates
        .into_iter()
        .flatten()
        .find(|p| p.exists())
        .unwrap_or_else(|| PathBuf::from("notepad.exe"));
    let mut c = Command::new(exe);
    c.arg(target);
    c
}

#[cfg(not(target_os = "windows"))]
fn default_editor(target: &Path) -> Command {
    let mut c = Command::new(if cfg!(target_os = "macos") { "open" } else { "xdg-open" });
    c.arg(target);
    c
}

/// Opens a link from the Markdown preview in the default browser or mail client.
/// Only http, https and mailto links are allowed.
#[tauri::command]
fn open_url(url: String) -> Result<(), String> {
    let lower = url.to_ascii_lowercase();
    if !(lower.starts_with("https://") || lower.starts_with("http://") || lower.starts_with("mailto:")) {
        return Err("Only http, https and mailto links can be opened".into());
    }
    url_command(&url).spawn().map(|_| ()).map_err(|e| e.to_string())
}

#[cfg(target_os = "windows")]
fn url_command(url: &str) -> Command {
    // Not "cmd /c start": cmd would interpret characters like & in the URL.
    let mut c = Command::new("rundll32.exe");
    c.args(["url.dll,FileProtocolHandler", url]);
    c
}

#[cfg(not(target_os = "windows"))]
fn url_command(url: &str) -> Command {
    let mut c = Command::new(if cfg!(target_os = "macos") { "open" } else { "xdg-open" });
    c.arg(url);
    c
}

// ------------------------------------------------------------------ tray

fn build_tray(app: &tauri::App) -> tauri::Result<()> {
    let show = MenuItem::with_id(app, "show", "Show DocView", true, None::<&str>)?;
    let clip = MenuItem::with_id(app, "clipboard", "Show clipboard", true, None::<&str>)?;
    let open = MenuItem::with_id(app, "open", "Open file…", true, None::<&str>)?;
    let settings = MenuItem::with_id(app, "settings", "Settings…", true, None::<&str>)?;
    let update = MenuItem::with_id(app, "check-update", "Check for updates", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let sep = PredefinedMenuItem::separator(app)?;
    let menu = Menu::with_items(app, &[&show, &clip, &open, &settings, &update, &sep, &quit])?;

    let mut builder = TrayIconBuilder::with_id("main")
        .tooltip("DocView")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => show_main(app),
            "clipboard" => show_clipboard(app),
            "open" | "settings" | "check-update" => {
                show_main(app);
                let _ = app.emit("menu", event.id.as_ref());
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
                show_main(tray.app_handle());
            }
        });
    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }
    builder.build(app)?;
    Ok(())
}

// ------------------------------------------------------------------ entry

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Must be registered first: forwards argv from a second launch.
        .plugin(tauri_plugin_single_instance::init(|app, argv, cwd| {
            handle_args(app, &argv, Path::new(&cwd), false);
        }))
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, _shortcut, event| {
                    if event.state() == ShortcutState::Pressed {
                        show_clipboard(app);
                    }
                })
                .build(),
        )
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, Some(vec!["--background"])))
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .manage(AppState::default())
        .setup(|app| {
            let handle = app.handle().clone();
            let settings = load_settings(&handle);
            let shortcut = shortcut_of(&settings);
            *app.state::<AppState>().settings.lock().unwrap() = settings;
            if let Err(e) = register_shortcut(&handle, &shortcut) {
                eprintln!("{e}");
            }
            build_tray(app)?;
            let args: Vec<String> = std::env::args().collect();
            let cwd = std::env::current_dir().unwrap_or_default();
            handle_args(&handle, &args, &cwd, true);
            Ok(())
        })
        .on_window_event(|window, event| {
            // Closing the window only hides it; the app lives on in the tray.
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .invoke_handler(tauri::generate_handler![
            take_pending,
            read_file,
            write_file,
            get_settings,
            save_settings,
            shortcut_status,
            open_in_editor,
            open_url,
            load_history,
            save_history
        ])
        .run(tauri::generate_context!())
        .expect("error while running DocView");
}
