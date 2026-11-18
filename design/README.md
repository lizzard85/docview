# Handoff: DocView redesign (light + dark)

## Overview
A visual redesign of the DocView desktop app (lizzard85/docview). The app's structure and features stay the same: tabs, a toolbar, a code view, and a side panel (Tree for JSON/XML, Table for CSV). The redesign replaces the stock Windows look with a warm, rounded style in two themes, light and dark.

**Chosen direction: 2a – one combined toolbar.** All actions sit in a single rounded bar under the tabs, separate from the code view. Implement 2a only. The design file also contains 2b and an older round 1 for reference. Do not implement them.

## Owner decisions (read first – these override the rest of this file)
This is a **redesign, not new functionality**. Implement the look and layout from this handoff, including the addendum. Keep the app's existing behaviour, features, labels, shortcuts and settings as they are. If a section below describes behaviour the app does not have today, do not build it. Use only its visual style for the existing feature.

**Adopt:**
- Everything visual: tokens, themes, fonts, icons, radii, the custom title bar, tabs, toolbar, menus, dialogs, notices, toasts, tooltips, scrollbars, syntax colours, language dots, splitter look, empty state.
- Layout behaviour that the new design needs:
  - The custom title bar, including the drag area and window controls.
  - The "Use system title bar" setting.
  - Tabs that are always visible, plus tab overflow with the "all tabs" menu.
  - The responsive toolbar with the "…" and "View ▾" menus.
  - The panel as an overlay on narrow windows.
- **Compare: add "Ignore whitespace"** as a new toggle. Keep the existing "Raw text" toggle as well.
- **Font size follows the design guide (addendum §6):**
  - Range 10–24px, default 13.5px, steps of 1px.
  - Line height is round(size × 1.63).
  - Tree and table text is the code size − 0.5px.
  - UI chrome does not scale.
  - Clamp existing saved values into the new range.
  - Keep the existing zoom shortcuts.

**Do not adopt (keep the current behaviour and only restyle it).** The features among these are listed in `docs/IDEAS.md` for later:
- **Notices:** keep showing several notices at once. Style each one as the described notice bar and stack them.
- **Compare:** keep the current entry flow (the prompt to paste, open or pick from the history). Do not add the Clipboard/tabs/File menu or "Swap sides".
- **Search:** no Aa/regex toggles and no match ticks on the scrollbar. Style the existing search bar as the floating pill.
- **Format errors:** no "Go to line" button.
- **Shortcut editor:** keep the current conflict handling (the key moves at once and the other action loses it). Do not add confirm-on-second-press or Backspace to remove.
- **"Show more":** keep the current chunk size (500) and the current text. Restyle only.
- **Splitter:** keep the current width handling. Do not add a width per panel type or double-click to reset. The new minimum widths are fine.
- **Update bar:** keep the existing actions and labels ("Update and restart", "Later").
- **Low-confidence "guess":** make it a label only. Clicking it does not open the language menu.

## About the design files
The files in this bundle are **design references built in HTML**. They show the intended look and are not production code to copy. Recreate them in DocView's existing frontend (the Tauri web UI in `src/`) using its current patterns. Keep all existing behaviour, shortcuts and settings. Only the presentation changes.

The mockups are static. Buttons are not wired up, and the selection, line highlight, and so on are drawn as fixed states.

## Fidelity
High-fidelity. Colours, type, radii and spacing are final. Match them closely.

## Screens
Direction 2a has four screens at 1280×800: JSON Light, CSV Light, JSON Dark, CSV Dark. They are in `DocView.dc.html` under "Runde 2", id `#2a`, the left column.

### Window shell
- Window background: `--color-bg` (theme-dependent, see tokens). Padding is 10px 16px 16px in 2a and 12px 16px 16px in 2b.
- The custom title bar holds the tabs. Window controls (minimise, maximise, close) are 16px Lucide-style icons on the right, `--color-neutral-700`, with an 18px gap.
- **Tabs** are pills, 32px tall (2a) or 34px (2b), with 13px text and a 7px coloured dot that shows the language. The close "×" sits in a 22px circle.
  - Active tab: `--dv-card` background, `--shadow-sm` in 2a, weight 600.
  - Inactive tab: transparent background in 2a, `--color-surface` in 2b. Text is `--color-neutral-700` in 2a and `--color-neutral-800` in 2b.
  - "+" for a new tab: a ghost circle in 2a, a 34px dashed circle in 2b.
- **Logo**: a "D" in an accent-coloured circle, 28px in 2a and 34px in 2b. In 2b it is followed by the word "DocView" at 20px, weight 700.

### Toolbar (2a)
A full-width pill (`border-radius: 999px`) with a `--color-surface` background, 6px padding and a 6px gap. From left to right:
1. **Language select**: a 34px pill with a `--dv-card` background and `--shadow-sm`, 14px bold text and a chevron. Next to it, a 12.5px "✓ recognized" label in `--color-accent-2-700`.
2. **Toggles** for Format, Wrap and Line no. Each is a 32px pill, 13px.
   - On: `--dv-on-bg` background, `--dv-on-text` text, weight 600, with a check icon.
   - Off: 1px `--color-divider` border, `--color-neutral-800` text.
3. **Panel toggle** (Tree or Table): a pill with `--dv-hi-bg` background and `--dv-hi-text` text, plus a panel-right icon.
4. **Convert ▾**, JSON only. Plain text button.
5. Flexible spacer, then the line count ("5,546 lines"): 12.5px, `--color-neutral-700`.
6. Icon buttons, 36px circles: History, Compare, Editor, Save.
7. **Copy split button**: "Copy" plus a ▾ that opens Copy colours. Pill with a 1px divider border.
8. **Open…** as a secondary button (bordered pill), then **Paste** as the primary button (solid `--color-accent`, text `--color-bg`). Paste is the only solid accent button.
9. Settings icon button.

### Main area
A grid with a 12px gap.
- JSON: `minmax(0,1fr) 430px`.
- CSV: `minmax(0,1fr) 500px`.

**Code card**
- `--dv-card` background, 28px radius (2b uses 28 × 1.15 ≈ 32px), `--shadow-sm`.
- Code text: JetBrains Mono 13.5px, line-height 22px.
- Each row is flex with an 8px radius and 10–12px side margin. The 44px right-aligned line-number gutter has 18px right padding.
- Highlighted lines (the block of the node selected in the tree) get a `--dv-hi-bg` background. Their line numbers turn `--color-accent-700` (light).
- Syntax colours (the ramp variables flip in dark, so the same names work in both themes):
  - Key: `--color-accent-700`, weight 600
  - String: `--color-accent-2-700`
  - Number: `--color-accent-600`
  - true/false/null: `--color-accent-800`, weight 600
  - Punctuation: `--color-neutral-600`
  - Line numbers: `--color-neutral-500`
  - CSV: the header row uses the key colour. Plain fields use `--color-text`. Commas use the punctuation colour.

**Side panel**
- Background: `--color-surface` in 2a, `--color-accent-2-100` (sage) in 2b. Radius as the code card.
- **Header** (padding 14 12 10 20, 6px gap):
  - 2a only: a title ("Tree" or "Table"), 18px weight 700.
  - A filter pill, 34px, with a search icon and "Filter…". Its background is `--color-neutral-100` in 2a and `--color-bg` in 2b.
  - CSV only: a "✓ Header" toggle.
  - Jump-to-line eye button, active (tinted).
  - JSON only: + (expand all) and − (collapse all).
  - × (close panel).
- **Tree rows**: 28px tall pills, 13.5px.
  - Indent is 10px + 18px × depth.
  - Caret ▸/▾ in a 12px column. Key weight 600. The value follows in JetBrains Mono 12.5px, with ellipsis when too long.
  - Value colours: meta like "{5 keys}" in `--color-neutral-600`, strings in `--color-accent-2-700`, numbers in `--color-accent-600`.
  - Selected row: `--dv-hi-bg` background, key `--color-accent-800`. In 2b the selected row uses `--color-accent-2-300`.
- **Table**: a CSS grid with columns `28px 40px 1fr 1fr 1.9fr 40px`, a 10px gap, and 9px 14px padding per row. Every row is a pill.
  - Header row: `--color-neutral-300` background (2b: `--color-accent-2-300`), weight 700.
  - Row-number column: `--color-neutral-600`. Selected row: `--dv-hi-bg`.
- **Footer** (padding 10 12 12 20):
  - JSON: the path chip "$[5]" (mono 12.5px pill), a spacer, then "Copy path" and "Copy value" as secondary buttons.
  - CSV: "3 rows · row 3 selected" in 13px muted text, a spacer, then "Copy value".

## Interactions and states
These are not shown in the static mockups. Follow the design system rules:
- Every interactive element has a hover tint. Ghost and icon buttons use `color-mix(in srgb, var(--color-accent) 10%, transparent)`, and 18% when pressed.
- The primary button uses `--color-accent-600` on hover and `--color-accent-700` when pressed.
- Keyboard focus: `outline: 2px solid var(--color-accent); outline-offset: 2px`. Never the default blue ring.
- Disabled controls: opacity 0.45.
- Tooltips should show the current shortcut keys, as the app already does.
- The theme follows the OS (`prefers-color-scheme`). Optionally add a setting under General.

## Design tokens
Source: the Organic design system's `styles.css` (included). Fonts are **Figtree** for all UI text (headings use weight 700, letter-spacing −0.01em) and **JetBrains Mono** for code. Both are on Google Fonts.

Note: the design system specifies Caprasimo for headings. The owner rejected it, so do not use it.

Radii:
- Pills (buttons, inputs, chips, rows): 999px
- Cards: 28px (`--radius-lg`)
- Code lines: 8px

Shadows:
- Light:
  - sm: `0 1px 2px color-mix(in srgb, #2e2b25 14%, transparent)`
  - md: `0 3px 10px color-mix(in srgb, #2e2b25 16%, transparent)`
  - lg: `0 12px 32px color-mix(in srgb, #2e2b25 22%, transparent)`
- Dark:
  - sm: `0 1px 2px rgba(0,0,0,.35)`
  - md: `0 3px 10px rgba(0,0,0,.4)`
  - lg: `0 12px 32px rgba(0,0,0,.5)`

### Theme roles
Dark mode **inverts each ramp**: step 100 takes the value of 900, 200 takes 800, and so on, with 500 unchanged. Components therefore always use the same variable names.

| Role | Light | Dark |
|---|---|---|
| --color-bg | `#f9f4ed` (neutral-100) | `color-mix(in oklch, #2e2b25 70%, black)` |
| --color-surface | `#eee7db` (neutral-200) | `color-mix(in oklch, #2e2b25 88%, black)` |
| --dv-card (code card, active tab) | `#fcfaf7` | `#2e2b25` (neutral-100 inverted) |
| --color-text | `#201e1d` | `#f5ead8` |
| --color-divider | text at 16% | cream at 16% |
| --dv-on-bg / --dv-on-text (toggle on) | `#f0fae1` / `#3d472b` | `#3d472b` / `#f0fae1` |
| --dv-hi-bg / --dv-hi-text (selection, panel toggle) | `#fff2eb` / `#8c491a` | `#643312` / `#ffe1d0` |
| --color-accent | `#c67139` | same |
| --color-accent-2 | `#7a8a5e` | same |

Avoid `color-mix(in oklch, …, white)`. White has a bluish hue in OKLCH, so the result turns lilac. Mix with white in sRGB.

### Ramps (light value → value used in dark)
Neutral
| Step | Light | Dark |
|---|---|---|
| 100 | `#f9f4ed` | `#2e2b25` |
| 200 | `#eee7db` | `#474238` |
| 300 | `#dcd3c4` | `#645c50` |
| 400 | `#c0b6a5` | `#82796a` |
| 500 | `#a19786` | `#a19786` |
| 600 | `#82796a` | `#c0b6a5` |
| 700 | `#645c50` | `#dcd3c4` |
| 800 | `#474238` | `#eee7db` |
| 900 | `#2e2b25` | `#f9f4ed` |

Accent (terracotta)
| Step | Light | Dark |
|---|---|---|
| 100 | `#fff2eb` | `#402310` |
| 200 | `#ffe1d0` | `#643312` |
| 300 | `#ffc6a5` | `#8c491a` |
| 400 | `#f6a06b` | `#b2622d` |
| 500 | `#d67f48` | `#d67f48` |
| 600 | `#b2622d` | `#f6a06b` |
| 700 | `#8c491a` | `#ffc6a5` |
| 800 | `#643312` | `#ffe1d0` |
| 900 | `#402310` | `#fff2eb` |

Accent 2 (sage)
| Step | Light | Dark |
|---|---|---|
| 100 | `#f0fae1` | `#272e1b` |
| 200 | `#e1eecc` | `#3d472b` |
| 300 | `#ccdbb2` | `#56633f` |
| 400 | `#aebf92` | `#728157` |
| 500 | `#8fa073` | `#8fa073` |
| 600 | `#728157` | `#aebf92` |
| 700 | `#56633f` | `#ccdbb2` |
| 800 | `#3d472b` | `#e1eecc` |
| 900 | `#272e1b` | `#f0fae1` |

## Icons
Lucide (https://lucide.dev) at stroke-width **2.75**. Icons used: search, chevron-down, check, x, plus, minus, history, git-compare, square-pen (Editor), save, clipboard (Paste), copy, palette (Copy colours), eye (jump to line), panel-right (Tree/Table), sliders-horizontal (Settings).



---

# Addendum: answers to the implementation questions

The visual reference for everything below is `DocView 2a Spec.dc.html`, in light and dark. Section numbers match the file.

All colours are ramp variables. Dark mode inverts the ramps, so one rule set covers both themes. `--dv-*` are the theme roles from the Design tokens section.

## 1. Custom title bar (Windows and Linux)
- Use `decorations: false` and draw the bar in-app. Height 40px with 10px top padding (the window padding).
- **Drag area:** every empty pixel of the bar is the drag area (`data-tauri-drag-region`): the logo, the gaps between tabs, and the space after the tab strip. At least 48px between the tab strip and the window controls is always kept draggable. Tabs, "+", "all tabs" and the controls are not drag regions.
- **Double-click** on the drag area maximises or restores. Wire it up by hand if the drag-region attribute doesn't already handle it.
- **Window controls:** 40×32 pills with a 2px gap and 15px icons in `--color-neutral-800`.
  - Hover on minimise or maximise: `--color-neutral-300` background.
  - Hover on close: `--color-accent-600` background with a #fff icon. Pressed: `--color-accent-700`.
  - Maximise swaps to a "restore" icon (two overlapping squares) when maximised.
- **Window edges:** don't draw rounded corners or a shadow in-app. Let the OS frame the window: Windows 11 DWM adds its own 8px rounding and shadow. When maximised or snapped, edges are square and nothing changes inside the window. The rounded outer frame in the mockups is presentation only.
- **Linux:** same custom bar, with controls always on the right. Add the setting **General → "Use system title bar"** (default off on Windows, on for tiling WMs if you can detect them). When on, use native decorations; the tab strip becomes the first row inside the window and keeps the logo.
- **Tabs always show**, even with one tab.
- **Tab overflow:**
  - Tabs are `flex: 0 1 auto`, with min-width 112px and max-width 210px.
  - When the tabs no longer fit at 112px, the strip scrolls horizontally (wheel, shift+wheel, or dragging the strip), with a 32px mask fade on the overflowing edge(s).
  - An **"all tabs"** pill appears (count + chevron). It opens a menu like History (dot, title, language) and the current tab is highlighted.
  - The active tab is always scrolled into view. Middle-click closes a tab.

## 2. Responsive toolbar (min window width 480px)
The order in which things collapse as the window narrows:

| Width | Change |
|---|---|
| ≥ 1100 | Everything visible |
| < 1100 | Line count hidden (it moves into the "…" menu header) |
| < 960 | "Copy ▾" becomes an icon + chevron; "Open…" becomes a folder icon; "recognized" becomes the ✓ icon only (tooltips keep the labels) |
| < 820 | History, Compare, Editor, Save and Convert move into a "…" (more) menu, in that order |
| < 720 | Copy (with Copy colours) moves into "…" |
| < 640 | Format, Wrap and Line no. collapse into "View ▾" (a menu of checkable items) |
| < 560 | Open moves into "…"; Paste becomes icon-only |

- The language pill, the panel toggle, Paste and Settings never leave the bar.
- Overflowed actions keep their shortcuts. The "…" menu shows each item with its shortcut chip.
- The side panel hides automatically when the window is narrower than 320 + 260 + 12 + 32px. The toggle stays, and turning it on opens the panel as an overlay sheet on the right, 85% wide.

## 3. Screens and components
- **Empty state:** see the spec board. Heading 24/700, body 14px `--color-neutral-700`, 2px dashed `--color-neutral-400` zone with 22px radius inside the code card.
  - Drag-over: the zone turns `--color-accent-2-100`, the border `--color-accent-2-500`, and the text "Drop to open" appears.
- **Search (Ctrl+F):** floating pill at the top-right of the code card, 12px inset, `--dv-card` background with `--shadow-md`. Contents: input (170px, accent focus ring) · "n of m" · Aa toggle · .* toggle · ↑ ↓ · ×.
  - Match: `--color-accent-2-200` background.
  - Current match: `--color-accent-300` background plus `box-shadow: 0 0 0 1.5px var(--color-accent)`.
  - Matches also appear as 3px ticks on the vertical scrollbar track (`--color-accent-2-500`; current: `--color-accent`).
  - Enter / Shift+Enter go to the next / previous match. Esc closes.
  - No matches: the count reads "No results" in `--color-accent-700`.
- **Notice bars:** 40px pills inside the code card (margin 10px 10px 0), 13.5px text with a bold lead-in and a 16px icon. Actions are 30px pills on `--dv-card`, with an optional key chip. The bar ends with a ×.
  - Info: `--color-accent-2-100` background, `--color-accent-2-900` text. Used for Escaped JSON, SQL parameters, Decoded, and Converted (+ Undo).
  - Warning/error: `--color-accent-100` background, `--color-accent-900` text. Used for expired JWT and format errors (+ "Go to line").
  - Update: `--color-surface`, full width between the toolbar and the main area. Actions "Later" and "Restart now" (primary).
  - Only one notice per tab; a new one replaces the old.
- **Compare:**
  - The Compare button opens a menu with Clipboard, other open tabs (with dots), and File….
  - The compare view replaces the main area. A toolbar pill shows "A ↔ B" · "Change n of m" · ↑ ↓ · Swap sides · Ignore whitespace (toggle) · Exit compare.
  - Two aligned `--dv-card` panes with a 12px gap and synchronised scrolling. Font 13/22.
  - Colours and gutter markers:

  | Change | Line background | Changed words | Gutter marker |
  |---|---|---|---|
  | Removed | `--color-accent-100` | `--color-accent-300` | "−" in `--color-accent-700` |
  | Added | `--color-accent-2-100` | `--color-accent-2-300` | "+" in `--color-accent-2-700` |
  | Changed | `--color-neutral-200` | as removed/added, per side | — |
  | Filler (opposite side) | `color-mix(in srgb, var(--color-neutral-300) 45%, transparent)` | — | — |

  - The current change gets `box-shadow: inset 3px 0 0 var(--color-accent)` on its lines.
- **Menus** (History, Convert, Copy ▾, language select, all tabs, View, …):
  - `--dv-card` background, 20px radius, `--shadow-lg`, 6px padding, opening 6px below the trigger with a 120ms ease-out fade + 4px slide.
  - Rows are 34px pills, 13.5px. Two-line rows use 16px radius and 6/12 padding, with a 12px `--color-neutral-600` sub-line.
  - Hover: `--color-neutral-200`. Selected/current: `--dv-hi-bg` / `--dv-hi-text`, weight 600, plus a ✓. Disabled: 45% opacity.
  - Search fields at the top: a 34px pill on `--color-neutral-200`.
  - Keyboard: arrows, Enter, Esc, type-to-filter.
- **Settings dialog:**
  - 860×600 modal, 32px radius, `--shadow-lg`, over a `color-mix(in srgb, var(--dv-ink) 45%, transparent)` backdrop.
  - Left nav is 210px on `--color-surface`; the active page uses `--dv-hi-bg`.
  - Shortcut rows: 22px radius on `--color-surface`. Key chips are mono 12px on `--dv-card` with `--shadow-sm`.
  - Changed rows show the reset (undo) icon.
  - Recording: the row gets `--dv-hi-bg`, a 2px accent ring, and "Press keys…" in `--color-accent-700`. Esc cancels, Backspace removes.
  - Conflicts: an inline 12.5px `--color-accent-800` line; pressing the keys again confirms the replacement.
  - General page: add **Theme** (System / Light / Dark, using `.seg`) and **Use system title bar**.
- **Toast:** an inverse pill (background `--color-text`, text `--color-bg`), 42px tall, 14/600, with a ✓ in `--color-accent-2-400`, `--shadow-lg`. Bottom-centre, 20px from the edge. Shown for 2.2s with a 160ms fade + 6px rise.
- **Tooltip:** an inverse pill, 30px, 12.5/600. The key chip uses `color-mix(in srgb, var(--color-bg) 20%, transparent)`. 500ms delay, 8px offset.
- **Markdown preview panel:** content sits on a `--dv-card` sheet (20px radius, 18px padding) inside the panel.
  - Type: h1 22/700, h2 16/700, body 13.5 with line-height 1.55.
  - Links: `--color-accent-700`, underlined.
  - Code: mono 12.5 on `--color-neutral-200`, 12px radius.
  - Blockquote: 3px inset `--color-accent-2-400` bar.
  - Task boxes: 15px, 5px radius; checked = `--color-accent-2-600` fill.
  - Tables use the CSV table style.
- **XML tree:** each row shows the element as markup, mono 12.5, with these colours:
  - Tag name: `--color-accent-800`, weight 600
  - Attribute name: `--color-accent-700`
  - Attribute value / text: `--color-accent-2-700`
  - `< > = /`: `--color-neutral-600`
  - Comments: `--color-neutral-600` italic
  - CDATA / child count: `--color-neutral-700`
- **"JSON string" marker:** a 10.5/700 uppercase pill "JSON STRING" on `--dv-on-bg` / `--dv-on-text`, placed after the key. The node is expandable like an object.
- **"Show more":** a 24px pill on `--color-neutral-100` with `--color-accent-700` 12.5/600 text "Show 100 more" and a muted "· N left", indented to the child level.
- **CSV sorting:** the sorted header cell becomes a `--dv-hi-bg` pill with an up or down arrow. Clicking a header cycles ascending → descending → original order. "#" always shows the source line.
- **Splitter:**
  - The 12px gap is the hit area, with the col-resize cursor.
  - On hover or drag, a 4×36 pill appears centred in `--color-accent` (`--color-neutral-400` while just hovering, accent while dragging).
  - Minimum widths: code 320px, panel 260px.
  - Width is stored per panel type (tree, table, preview). Double-click resets the width (JSON 430px, CSV 500px, Markdown 50%).
- **Scrollbars:** overlay style, inset 3px from the card edge, with no track.
  - Thumb: pill, 6px wide, `--color-neutral-400`.
  - Hover: 10px wide, `--color-neutral-500`.
  - Fade after 1s idle. Same in tree, table and menus.
  - On Windows, use `::-webkit-scrollbar` styles in the webview.

## 4. Syntax colours (highlight.js)
| hljs class(es) | Colour | Weight/style |
|---|---|---|
| keyword, selector-tag, selector-pseudo | `--color-accent-700` | 600 |
| string, regexp, template-tag, selector-attr, char.escape | `--color-accent-2-700` | |
| number | `--color-accent-600` | |
| literal (true/false/null) | `--color-accent-800` | 600 |
| built_in, type, title.class, class | `--color-accent-800` | |
| title.function, title, section | `--color-text` | 600 (section 700) |
| attr, attribute, property, selector-id, selector-class | `--color-accent-700` | |
| name (XML/HTML tag name), tag | `--color-accent-800` | 600 |
| variable, params, template-variable, symbol, link | `--color-accent-2-800` | (link underlined) |
| comment, quote | `--color-neutral-600` | italic |
| meta, meta keyword, doctag | `--color-neutral-700` | |
| punctuation, operator, subst | `--color-neutral-600` (subst: `--color-text`) | |
| addition | `--color-accent-2-800` text, line background `--color-accent-2-100` | |
| deletion | `--color-accent-800` text, line background `--color-accent-100` | |
| emphasis / strong | inherit | italic / 700 |
| (plain) | `--color-text` | |

JSON keys are hljs `attr` and use the key style from the main mock (`--color-accent-700`, weight 600).

## 5. Language dot colours
| Language | Variable | Language | Variable |
|---|---|---|---|
| JSON | --color-accent-500 | CSS | --color-accent-2-300 |
| CSV / TSV | --color-accent-2-500 | Shell / Bash | --color-neutral-700 |
| XML | --color-accent-700 | PowerShell | --color-neutral-600 |
| HTML | --color-accent-400 | INI / TOML | --color-neutral-500 |
| YAML | --color-accent-2-700 | Diff / Patch | --color-accent-2-900 |
| Markdown | --color-accent-2-400 | Log | --color-neutral-400 |
| SQL | --color-accent-2-600 | JWT | --color-accent-900 |
| C# | --color-accent-800 | Base64 / URL | --color-neutral-800 |
| Python | --color-accent-2-800 | Plain text | --color-neutral-300 |
| JavaScript | --color-accent-300 | (any other) | --color-neutral-500 |
| TypeScript | --color-accent-600 | | |

## 6. Small states
- **How the language was detected:**
  - Recognized from content: "✓ recognized" in `--color-accent-2-700`.
  - From the file extension: file icon + "file type" in `--color-neutral-700`.
  - Low-confidence guess: "?" icon + "guess" in `--color-accent-700`; clicking it opens the language menu.
  - A manually picked language shows nothing.
- **Panel toggle:** open = `--dv-hi-bg` fill. Closed = off style (1px `--color-divider` border, `--color-neutral-800`). The label follows the panel: Tree (JSON/XML), Table (CSV), Preview (Markdown). The toggle is hidden when the language has no panel.
- **Format disabled:** keep the on/off look at 45% opacity, `cursor: not-allowed`, with the tooltip "No formatter for <language>". Wrap and Line no. are never disabled.
- **Convert** is shown for JSON, YAML and XML. The current format appears disabled in the menu with the sub-line "current".
- **Font size:**
  - The setting ranges 10–24px (default 13.5). Ctrl+= and Ctrl+− step by 1px; Ctrl+0 resets.
  - Line height = round(size × 1.63): 11 → 18, 13.5 → 22, 16 → 26, 20 → 33.
  - The gutter is (digits + 1)ch with 1ch right padding.
  - Tree and table text = code size − 0.5px. Row height = line height + 6px.
  - UI chrome (toolbar, tabs, menus) does not scale.

## Files
- `DocView 2a Spec.dc.html`: the component and state spec (light + dark) referenced in the addendum.
- `DocView.dc.html`: the design. Open it in a browser; it needs `support.js` and `styles.css` alongside it. The current directions are under "Runde 2" (`#2a`, `#2b`). The sample data and syntax-colour logic are in the `<script>` class at the bottom.
- `support.js`: the runtime that renders the design file.
- `_ds/organic-…/styles.css`: the design system tokens and the component classes (`.btn`, `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.btn-icon`, `.seg`, `.tag`, `.input`).
- The theme overrides (`[data-dv-theme="light"|"dark"]`) are in the `<style>` block at the top of `DocView.dc.html`. Port them into the app's stylesheet.
