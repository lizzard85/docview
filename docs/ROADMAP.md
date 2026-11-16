# Roadmap

Planned features, in the order they should be built. See "Working on the roadmap" in [AGENTS.md](../AGENTS.md) for how to work through this list: one item per pull request, top to bottom.

Status markers: `[ ]` not started · `[x]` done (PR link after it).

When something is unclear, make a sensible decision, keep it simple, and write the decision in the PR description under **Decisions**. Do not stop to ask.

---

## 1. [x] Escaped JSON inside strings ([#18](https://github.com/lizzard85/docview/pull/18))

**Problem:** Logs and API responses often contain JSON stored as a string, e.g. `"{\"id\":1,\"name\":\"x\"}"`, or a whole pasted value that is one escaped JSON string. It is unreadable.

**Behaviour:**
- If the whole pasted text is a JSON string literal (or a bare escaped JSON text like `{\"id\":1}`) whose content is itself JSON, show the inner JSON (formatted, detected as JSON) and a notice: "Showing JSON that was escaped inside a string." Unescaping can be nested (a string containing an escaped string …); unwrap until it is no longer a JSON string, max ~5 levels.
- In the JSON tree, a string value whose content parses as a JSON object or array gets a marker (e.g. muted `{…} JSON` summary) and can be expanded like an object/array. Its children's paths continue from the string's path. "Copy value" on the string still copies the raw string.
- Only treat strings as JSON when they start with `{` or `[` after trimming and parse successfully; never guess otherwise.

**Tests:** detection/unwrapping of nested escaped strings; tree expansion of an embedded JSON string; plain strings that merely start with `{` but are invalid stay strings.

## 2. [x] SQL with parameters from EF Core / SQL Profiler ([#19](https://github.com/lizzard85/docview/pull/19))

**Problem:** SQL captured from SQL Server Profiler / Extended Events comes as `exec sp_executesql N'SELECT … WHERE Id = @p0', N'@p0 int', @p0=42`, and EF Core logs print the SQL and the parameters separately (`Executed DbCommand (3ms) [Parameters=[@__id_0='42' (Nullable = true)], CommandType='Text', CommandTimeout='30']` followed by the SQL). Neither can be run directly in SSMS.

**Behaviour:**
- Detect both forms when the language is SQL.
- Show a notice with a button **Inline parameters**. When clicked (and remembered as a setting, default on), the shown SQL has the parameters substituted with literals and is then formatted as usual. The original is kept so the toggle can be turned off again.
- Literals: strings `N'…'` / `'…'` with `'` doubled, numbers as-is, `NULL`, booleans as `1`/`0`, dates/GUIDs as quoted strings. Respect word boundaries so `@p1` does not replace part of `@p10`.
- For `sp_executesql`, also unescape the doubled quotes inside the `N'…'` SQL text.
- If parsing fails, leave the text untouched and do not show the button.

**Tests:** sp_executesql with several types and `@p1`/`@p10`; EF Core log line with multiple parameters, including strings with quotes and NULL; text without parameters is untouched.

## 3. [x] Decode Base64, URL encoding and JWT ([#20](https://github.com/lizzard85/docview/pull/20))

**Behaviour:**
- New language entries (or a "decoded" view) for: **JWT** (three base64url parts separated by dots), **Base64** (long text consisting only of base64 characters, decodes to valid UTF-8), **URL-encoded** text (contains `%XX` sequences or is a query string).
- JWT: show header and payload as formatted JSON (one JSON document with `header` and `payload`, or two sections), with `exp`, `iat`, `nbf` additionally shown as readable local date/time (e.g. in a notice line or as comments next to the values in the tree). Show whether the token is expired. Never try to verify the signature; say so in the notice.
- Base64 / URL: show the decoded text, and run language detection on the decoded text (so base64-encoded JSON ends up formatted as JSON). Notice line: "Decoded from Base64 – press D to show the original." `D` toggles decoded/original.
- Be conservative: short words or normal text must not be detected as Base64.

**Tests:** JWT decoding and expiry; base64 of JSON detected as JSON; URL-encoded query string; false positives (normal words, hex strings, short strings) are not decoded.

## 4. [x] Copy with colours

**Behaviour:**
- A **Copy with colours** action (a small menu on the Copy button or a second button; shortcut `Ctrl+Shift+Alt+C` is fine, but no `Ctrl+Alt+<key>` because that is AltGr on European layouts). It puts both `text/html` (highlighted, inline styles, monospace font; current theme colours or always the light theme – decide and document) and `text/plain` on the clipboard.
- Pasting into Outlook, Teams and Word should keep the colours.
- The Tauri clipboard plugin supports HTML (`writeHtml`); use it in the app and `navigator.clipboard.write` with `ClipboardItem` in the browser build.

**Tests:** the HTML produced uses inline styles (no classes) and escapes the text correctly.

## 5. [ ] History

**Behaviour:**
- Keep the last 30 contents (pasted text, clipboard via shortcut, opened files) with timestamp, detected language and a short preview. Identical consecutive content is not duplicated.
- A **History** button / `Ctrl+H` opens a list (dropdown or the side panel) to re-open an entry. Files are re-opened from the stored text, not from disk.
- Stored on disk next to `settings.json` (`history.json`) via new Rust commands, with a size cap (e.g. skip entries over 1 MB, total under ~10 MB). Setting to turn history off and a **Clear history** button in settings.

**Tests:** history list logic (dedupe, cap, ordering) as pure functions.

## 6. [ ] CSV / TSV table view

**Behaviour:**
- Detect CSV and TSV (consistent delimiter count per line; `,`, `;` and tab; quoted fields with embedded delimiters/newlines per RFC 4180). Add a `CSV` language entry.
- The side panel shows a table: first row as header (toggle), sticky header, sortable columns (click header; numeric sort when the column is numeric), filter box filtering rows, row count. Large files: render rows in chunks like the tree ("Show more").
- Selecting a cell jumps to its line in the code view (reuse the jump-to-line setting).

**Tests:** CSV parsing (quotes, escaped quotes, newlines in fields, `;` delimiter, TSV), delimiter detection, sorting.

## 7. [ ] Conversions

**Behaviour:**
- A **Convert** menu in the toolbar with the options valid for the current language: JSON → YAML, YAML → JSON, XML → JSON, JSON → XML (only when it maps cleanly), minify JSON, minify XML.
- The result replaces the shown content as a new content (so it can be copied, searched and viewed in the tree) with a notice "Converted from JSON – Undo" that restores the previous content.
- Use existing dependencies where possible (`fast-xml-parser` has a builder); YAML needs a small library such as `yaml`.

**Tests:** each conversion, including attributes in XML → JSON and arrays in JSON → YAML.

## 8. [ ] Compare two snippets

**Behaviour:**
- **Compare** button / `Ctrl+D`: takes the current content as the left side and asks for the right side (paste, open file, or pick from history if #5 exists).
- Side-by-side view with line diff and inline highlighting of changed characters; both sides are formatted first with the current settings so formatting differences do not show up as changes (toggle to compare raw text).
- Synchronized scrolling, next/previous change (`F7` / `Shift+F7`), count of changes. `Esc` leaves compare mode.
- A small diff library (e.g. `diff`) is fine.

**Tests:** diff of formatted JSON where only key order/whitespace differs (no changes), real changes detected.

## 9. [ ] Tabs

**Behaviour:**
- Several documents open at once; new content from the global shortcut or a file opens in a new tab (setting: new tab vs replace current), `Ctrl+T` new empty tab, `Ctrl+W` close, `Ctrl+Tab` / `Ctrl+Shift+Tab` switch, middle-click closes.
- Each tab keeps its own content, language choice, scroll position and panel state.
- Tab bar between toolbar and content; tab title is the file name or the first characters of the snippet.
- Open tabs are not restored on restart (history covers that).

**Tests:** tab state logic as pure functions.
