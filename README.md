# DocView

A small program for **viewing** code snippets and files. It is not an editor. Paste SQL, HTML, XML, JSON, CSS, YAML and so on, and DocView works out the language, formats it neatly and colours it.

- **Detects the language by itself**, even for small snippets without `<!DOCTYPE>`/`<?xml>` (e.g. a single `<td>`, an `<Order>` element or `select * from x`). The guess can be corrected in the drop-down.
- **Formats** JSON, SQL (T-SQL, PostgreSQL, MySQL and more), XML, HTML, CSS/SCSS/LESS, JavaScript/TypeScript, YAML, Markdown and GraphQL. Other languages (C#, Java, Python, PowerShell, Shell, PHP, INI, Dockerfile, Diff) are only highlighted.
- **Runs in the background** with an icon in the system tray. The global shortcut (default `Win+Alt+V`) shows the window with whatever is on the clipboard.
- **Opens files** via a dialog (`Ctrl+O`), drag and drop, "Open with" or the command line.
- Light/dark theme, line numbers, word wrap, zoom and search.
- Builds for **Windows** and **Linux** (Tauri v2).

The user interface is in Danish.

## Shortcuts

| Shortcut | Action |
|---|---|
| `Win+Alt+V` (global, configurable) | Show DocView with the clipboard contents |
| `Ctrl+V` | Paste new content |
| `Ctrl+O` | Open file |
| `Ctrl+F`, `F3` / `Shift+F3` | Search, next/previous match |
| `Ctrl+Shift+C` | Copy the formatted text |
| `Ctrl+E` | Open in external editor (Notepad++ if installed) |
| `Ctrl +` / `Ctrl -` / `Ctrl 0` | Zoom |
| `F` / `W` / `L` | Toggle formatting / word wrap / line numbers |
| `Ctrl+,` | Settings |
| `Esc` | Close search, otherwise hide the window |

Closing the window keeps the program running in the system tray. Quit it from the tray menu.

The shortcut is deliberately not `Ctrl+Shift+V`. That is already "paste as plain text" in browsers, Office, Teams and so on. `Ctrl+Alt` combinations are avoided too, because `Ctrl+Alt` is `AltGr` on many European keyboard layouts.

## Command line

```bash
docview file.sql         # open a file
docview --clipboard      # show the clipboard
docview --background     # start hidden in the system tray (used for autostart)
```

If DocView is already running, the arguments are forwarded to the running instance.

### Linux and Wayland

On X11 the global shortcut works directly. On Wayland (GNOME/KDE) applications may not register global shortcuts themselves. Instead, create a keyboard shortcut in the system settings that runs `docview --clipboard`. The same works on Windows with a shortcut to `DocView.exe --clipboard` if you don't want the program running in the background.

## Updates

DocView checks GitHub Releases for a new version shortly after start and then every 6 hours. When one is found, a bar at the top offers **Opdatér og genstart** (update and restart). The update is downloaded, its signature is verified and it is installed in the background. You can turn the automatic check off in the settings, and check manually from the settings or the tray menu.

On Linux only the AppImage updates itself. A `.deb` installation must be updated with a new `.deb`.

### Making a release

1. Create a release on GitHub with a new tag `vX.Y.Z` (e.g. `v0.2.1`) targeting `main`, and publish it. Pushing the tag from the command line works too.
2. The workflow sets the app version from the tag and builds the installers. It then uploads them together with the update packages and `latest.json` to the release. If the workflow had to create the release itself, it is a draft that you publish.
3. Installed copies pick up the new version on their next check.

The update packages are signed with a key stored in the repository secrets `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`. The matching public key is in `src-tauri/tauri.conf.json`. Keep a backup of the private key: without it, existing installations cannot receive updates. This key is only for updates and has nothing to do with Windows code signing.

## Windows SmartScreen

The installers are not code-signed, so Windows SmartScreen warns on the first install of a downloaded installer. Click **More info → Run anyway**. Updates installed by DocView itself are not marked as downloaded from the internet, so normally they do not trigger the warning.

To remove the warning entirely you need a code-signing certificate, e.g. Azure Trusted Signing (about USD 10/month, availability depends on country and whether you are an individual or a company) or an OV certificate from a certificate authority. Even then, SmartScreen only stops warning once the app has built up a reputation.

## Development

Requirements: [Node.js](https://nodejs.org) 20+ and [Rust](https://rustup.rs). On Linux you also need:

```bash
sudo apt install libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev libxdo-dev build-essential
```

```bash
npm install
```

```bash
npm run tauri dev       # run the app with hot reload
```

```bash
npm test                # unit tests (detection, formatting, rendering)
```

```bash
npm run tauri build     # build an installer (.msi/.exe on Windows, .deb/.AppImage on Linux)
```

`npm run dev` starts only the frontend in a normal browser at http://localhost:1420, which is handy when working on the viewer.

GitHub Actions (`.github/workflows/build.yml`) runs the tests on every push and pull request. The Windows and Linux installers are only built when you push a version tag or start the workflow manually, to save Actions minutes.

- Pushing a tag such as `v0.1.0` creates a draft release with the installers.
- Starting the workflow manually under Actions → Build → "Run workflow" makes the installers available as artifacts on the run.

## Structure

```
src/                 Frontend (TypeScript + Vite)
  detect.ts          Language detection (scoring + parser validation)
  format.ts          Formatting (Prettier, sql-formatter, xml-formatter)
  render.ts          Highlighting (highlight.js) and line splitting
  search.ts          Search
  main.ts            UI
  backend.ts         Calls into the Rust side (also works without Tauri in a browser)
src-tauri/           Rust: tray, global shortcut, single instance, files, settings
tests/               Vitest tests
```

Settings are stored in `%APPDATA%\io.github.docview\settings.json` on Windows and `~/.config/io.github.docview/settings.json` on Linux.
