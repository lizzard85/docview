# DocView

A small desktop app for **viewing** code snippets and files – not an editor. Paste or open some SQL, JSON, XML, HTML, YAML, Markdown or similar, and DocView figures out the language, formats it and highlights it. JSON and XML can also be browsed as a tree, and Markdown is shown rendered.

It runs quietly in the system tray, so a global shortcut brings up whatever is on the clipboard, nicely formatted, in a second.

Runs on **Windows** and **Linux**. Built with [Tauri v2](https://tauri.app).

## Installation

Download the latest version from the [Releases](https://github.com/lizzard85/docview/releases/latest) page:

| Platform | File |
|---|---|
| Windows | `DocView_x.y.z_x64-setup.exe` (recommended) or `DocView_x.y.z_x64_en-US.msi` |
| Linux | `DocView_x.y.z_amd64.AppImage` (updates itself) or `DocView_x.y.z_amd64.deb` |

The Windows installers are not code-signed, so SmartScreen warns the first time you run a downloaded installer. Click **More info → Run anyway**.

On Linux, make the AppImage executable (`chmod +x DocView_*.AppImage`) and run it.

## Features

### Language detection
- Detects the language by itself (including CSV/TSV tables), even for small fragments without `<!DOCTYPE>` or `<?xml>`: a single `<td>`, an `<Order>` element or `select * from x` is enough.
- Candidates are scored from patterns in the text and, where possible, confirmed with a real parser. Files are recognised by their extension.
- The toolbar shows how the language was found (file type, recognised, guess) and you can always pick another one from the drop-down.

### Formatting and highlighting
- **Formats** JSON, SQL, XML, HTML, CSS/SCSS/LESS, JavaScript/TypeScript, YAML, Markdown and GraphQL.
- SQL formatting supports T-SQL (SQL Server), standard SQL, PostgreSQL, MySQL, MariaDB, SQLite, Oracle PL/SQL, DB2, BigQuery and Snowflake, with keywords kept as written, in UPPERCASE or in lowercase.
- **SQL with parameters**: SQL captured from SQL Server Profiler / Extended Events (`exec sp_executesql N'…', N'@p0 int', @p0=42`) and EF Core command logs (`Executed DbCommand … [Parameters=[@__id_0='42'], …]` followed by the SQL) are recognised. The parameters are substituted with literals so the SQL can be run directly in SSMS; a notice offers **Show original** / **Inline parameters**, and the choice is remembered.
- **Decodes** encoded text: a **JWT** is shown as JSON with its header and payload, plus the `exp`, `iat` and `nbf` times in local time and whether the token is expired (the signature is never verified). **Base64** and **URL-encoded** text (including query strings, shown as one `key=value` per line) are decoded, and the decoded text gets its own language detection – Base64-encoded JSON is shown as formatted JSON. `D` switches between the decoded text and the original. Short strings, normal words and hex strings are never decoded.
- **Highlights** all of the above plus C#, Java, Python, PowerShell, Shell, PHP, INI/TOML, Dockerfile and diffs/patches.
- **Escaped JSON**: when the pasted text is JSON stored inside a string (`"{\"id\":1}"` or a bare `{\"id\":1}`, as often found in logs), the inner JSON is shown and formatted, with a notice. Nested escaping is unwrapped up to 5 levels.
- Formatting can be turned off (`F`) to see the text exactly as it was. If something cannot be formatted, the original is shown with a note explaining why.
- **Convert** (toolbar menu, shown for JSON, YAML and XML): JSON → YAML, YAML → JSON, XML → JSON, JSON → XML (only offered when the JSON maps cleanly to XML), minify JSON and minify XML. The result is shown as new content – it can be copied, searched and browsed in the tree – with a notice "Converted from JSON – **Undo**". In JSON, XML attributes are `@name` keys and element text next to attributes is `#text`; values are kept as text.
- **Copy with colours** (`Ctrl+Shift+Alt+C` or the **Copy colours** button) puts the highlighted code on the clipboard as HTML with inline styles (plus plain text), so pasting into Outlook, Teams or Word keeps the colours. It always uses the light theme colours and a monospace font, so the result is readable on a white page or e-mail.
- Line numbers, word wrap, zoom and light/dark theme (or follow the system).
- Search with highlighting of all matches (`Ctrl+F`, `F3` / `Shift+F3`).

### Side panel: JSON and XML tree, CSV table, Markdown preview
For JSON, XML, CSV/TSV and Markdown a panel opens to the right of the code (toggle it with the **Tree**/**Table**/**Preview** button or `T`; drag the divider to resize it).

- **JSON tree** – expand and collapse objects and arrays, see their size (`{3 keys}`, `[12 items]`) and values coloured by type.
- String values that contain a JSON object or array are marked `JSON string` and can be expanded like the object/array itself; paths continue inside them (`$.payload.id`). **Copy value** on the string still copies the raw string.
- **XML tree** – elements with their attributes, text, comments and CDATA in document order. Elements that only contain text are shown as `name: value`.
- **Filter** the tree by key or value; matches are revealed and their parents opened.
- **Copy path / Copy value** for the selected node. Paths are JSONPath (`$.items[3].name`) or XPath (`/orders/order[2]/@id`). Values are copied as-is, objects as indented JSON and elements as indented XML.
- **Jump to line** – selecting a node scrolls the code view to that line (toggle with the eye button).
- Keyboard: arrow keys to move, expand and collapse; `Enter` toggles; `Ctrl+C` copies the value.
- Large documents stay responsive: tree nodes are only built when expanded.
- **CSV / TSV table** – CSV and TSV are detected by a consistent number of fields per line (`,`, `;` or tab, quoted fields with delimiters and line breaks per RFC 4180) or by the `.csv`/`.tsv` extension. The table has a sticky header (the first row; toggle with **Header**), sortable columns (click a header: ascending, descending, unsorted; numeric columns sort by value, including decimal commas), a filter box and a row count. Large files render 500 rows at a time (**Show more**). Selecting a cell jumps to its line in the code (eye button), arrow keys move between cells and `Ctrl+C` / **Copy value** copies the cell.
- **Markdown preview** – GitHub-flavoured Markdown (tables, task lists, fenced code with highlighting). Embedded HTML is sanitised, and links open in your default browser.

### Always at hand
- Runs in the background with an icon in the **system tray**. Closing the window only hides it; quit from the tray menu.
- **Global shortcut** (`Win+Alt+V` on Windows, `Super+Alt+V` on Linux, configurable) shows the window with the current clipboard contents.
- Optional **start at login**.
- Only one instance runs; opening a file while DocView is running sends it to the open window.

### Compare
- **Compare** button or `Ctrl+D`: the current content becomes the left side; paste (`Ctrl+V`), open/drop a file or pick from the history for the right side.
- Side-by-side view with a line diff and changed characters highlighted, synchronized scrolling and the number of changes. `F7` / `Shift+F7` (or the arrow buttons) go to the next / previous change, `Esc` leaves compare mode.
- Both sides are formatted with the current settings first (JSON also with sorted keys), so formatting and key order do not show up as changes. Tick **Raw text** to compare the texts exactly as they are. Pasting again while comparing replaces the right side.

### History
- The last 30 contents (pasted text, clipboard via the shortcut, opened files) are kept with time, detected language and a short preview. Showing the same content again moves it to the top instead of adding a duplicate.
- **History** button or `Ctrl+H` opens the list; pick an entry (mouse, arrow keys + `Enter`) to show it again. Files are re-opened from the stored text, not from disk.
- Stored in `history.json` next to `settings.json`. Contents over 1 MB are not stored and the whole history stays under about 10 MB. History can be turned off in the settings (which also deletes it), and **Clear history** removes it.

### Files
- Open files with `Ctrl+O`, drag and drop, *Open with*, or from the command line.
- Files up to 20 MB are loaded (larger files show the beginning). Binary files are refused, and files that are not UTF-8 are read as Windows-1252/Latin-1.
- **Open in external editor** (`Ctrl+E`) – Notepad++ if installed, otherwise Notepad on Windows or the default app on Linux. A different editor can be set in the settings.

### Automatic updates
DocView checks for a new version shortly after start and then every 6 hours. When one is found, a bar offers **Update and restart**; the update is downloaded, its signature verified and installed. The automatic check can be turned off in the settings, and you can check manually from the settings or the tray menu.

On Linux only the AppImage updates itself; a `.deb` installation is updated by installing the new `.deb`.

## Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `Win+Alt+V` / `Super+Alt+V` (global, configurable) | Show DocView with the clipboard contents |
| `Ctrl+V` | Paste new content |
| `Ctrl+O` | Open file |
| `Ctrl+H` | History of recent contents |
| `Ctrl+D` | Compare with another snippet |
| `F7` / `Shift+F7` | Next / previous change (compare mode) |
| `Ctrl+F`, `F3` / `Shift+F3` | Search, next / previous match |
| `Ctrl+Shift+C` | Copy the shown (formatted) text |
| `Ctrl+Shift+Alt+C` | Copy with colours (for Outlook, Teams, Word) |
| `Ctrl+E` | Open in external editor |
| `Ctrl +` / `Ctrl -` / `Ctrl 0` | Zoom in / out / reset |
| `F` / `W` / `L` | Toggle formatting / word wrap / line numbers |
| `T` | Toggle the side panel (tree / table / preview) |
| `D` | Switch between decoded text (JWT, Base64, URL encoding) and the original |
| `Ctrl+,` | Settings |
| `Esc` | Close a menu, search or compare mode, otherwise hide the window |

The default global shortcut is deliberately not `Ctrl+Shift+V` (already "paste as plain text" in browsers, Office, Teams and others), and `Ctrl+Alt` combinations are avoided because `Ctrl+Alt` acts as `AltGr` on many European keyboard layouts.

## Settings

Open them with the ⚙ button, `Ctrl+,` or the tray menu: global shortcut, theme, font size, indentation, SQL dialect and keyword case, external editor, start at login, automatic updates and history (with **Clear history**). Formatting, word wrap, line numbers, the side panel, the CSV header toggle and inlining of SQL parameters remember their state.

Settings are stored in `%APPDATA%\io.github.docview\settings.json` on Windows and `~/.config/io.github.docview/settings.json` on Linux; the history is in `history.json` in the same folder.

## Command line

```bash
docview file.sql         # open a file
docview --clipboard      # show the clipboard
docview --background     # start hidden in the system tray (used for start at login)
```

If DocView is already running, the arguments are passed to the running instance.

### Wayland

On X11 the global shortcut works directly. On Wayland (GNOME, KDE) applications may not be allowed to register global shortcuts themselves. Instead, create a keyboard shortcut in the system settings that runs `docview --clipboard`. The same trick works on Windows with a shortcut to `DocView.exe --clipboard` if you prefer not to keep DocView running in the background.

## Development

Requirements: [Node.js](https://nodejs.org) 20+ and [Rust](https://rustup.rs). On Linux you also need:

```bash
sudo apt install libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev libxdo-dev build-essential
```

```bash
npm install
npm run tauri dev       # run the app with hot reload
npm test                # unit tests (Vitest)
npm run tauri build     # build installers for the current OS
```

`npm run dev` starts only the frontend in a normal browser at http://localhost:1420, which is handy when working on the viewer (native features like the tray and global shortcut are then unavailable).

### Project structure

```
src/                 Frontend (TypeScript + Vite)
  main.ts            UI and wiring
  detect.ts          Language detection (pattern scoring + parser validation)
  format.ts          Formatting (Prettier, sql-formatter, xml-formatter)
  render.ts          Highlighting (highlight.js) and line splitting
  search.ts          In-view search
  panel.ts           Side panel
  tree.ts            Lazy tree view with filter
  jsonTree.ts        JSON -> tree nodes
  xmlTree.ts         XML -> tree nodes
  csv.ts             CSV/TSV parsing, delimiter detection, sorting, filtering
  tableView.ts       CSV table view
  locate.ts          Maps tree paths to lines in the code view
  escapedJson.ts     JSON escaped inside strings
  history.ts         History list logic (dedupe, caps)
  richCopy.ts        Highlighted HTML with inline styles (Copy with colours)
  convert.ts         JSON / YAML / XML conversions and minify
  compare.ts         Line and character diff for Compare
  compareView.ts     Side-by-side compare view
  dropdown.ts        Drop-down menus (History, Convert)
  decode.ts          JWT, Base64 and URL decoding
  sqlParams.ts       sp_executesql / EF Core parameters -> inlined SQL
  markdown.ts        Markdown preview (marked + DOMPurify)
  update.ts          Automatic updates
  backend.ts         Calls into the Rust side (degrades gracefully in a browser)
src-tauri/           Rust: tray, global shortcut, single instance, files, settings, history
tests/               Unit tests
```

### Releases

Releases are built and published only by the GitHub Actions workflow (`.github/workflows/build.yml`), never by hand:

1. Bump `version` in `package.json` (`npm version x.y.z --no-git-tag-version`) in a pull request and merge it into `main`.
2. The workflow sees a version without a release, builds Windows and Linux into a draft release (installers, signed update packages and `latest.json`) and publishes it only when every build has succeeded. Installed copies therefore never see an incomplete release.

Pushing a tag `vX.Y.Z` also triggers a release, and *Run workflow* under Actions builds the installers as artifacts without releasing. Tests run on every push and pull request. [AGENTS.md](AGENTS.md) has the detailed procedure.

Update packages are signed with a minisign key stored in the repository secrets `TAURI_SIGNING_PRIVATE_KEY` / `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`; the public key is in `src-tauri/tauri.conf.json`. If you fork the project and want working updates, generate your own key pair (`npm run tauri signer generate`), put the public key in `tauri.conf.json` and point the updater endpoint at your own releases.

## Roadmap

Planned features are listed in [docs/ROADMAP.md](docs/ROADMAP.md).

## License

[MIT](LICENSE) – free to use, modify and share, including commercially. The software is provided as is, without warranty of any kind.
