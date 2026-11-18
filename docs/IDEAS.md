# Ideas for later

Features that came up but are not planned yet. They are **not** roadmap items. Agents do not pick them up when working through [ROADMAP.md](ROADMAP.md). The owner moves an idea to the roadmap when it should be built.

## From the 2a redesign (November 2026)

The redesign handoff (`design/`) described these features. They were left out to keep the redesign about the look only. The visual spec for each is in `design/DocView 2a Spec.dc.html` and in the addendum of `design/README.md`.

- **Search options:** an `Aa` toggle for match case and a `.*` toggle for regular expressions.
- **Search ticks on the scrollbar:** 3px marks on the scrollbar track for every match, and a different colour for the current match.
- **Compare source menu:** the Compare button opens a menu with Clipboard, the other open tabs and File…, instead of the prompt bar.
- **Compare: swap sides:** a button that switches the left and right sides.
- **"Go to line" on format errors:** when formatting fails, a button in the notice jumps to the line of the error.
- **Splitter width per panel type:** the tree, table and preview each remember their own width. A double-click on the splitter resets it (JSON 430px, CSV 500px, Markdown 50%).
- **Click "guess" to pick the language:** clicking the low-confidence "guess" label opens the language menu.
- **Shortcut editor:**
  - When a key is already in use, ask for the keys to be pressed again to confirm, instead of moving the key at once.
  - Backspace while recording removes the shortcut.
