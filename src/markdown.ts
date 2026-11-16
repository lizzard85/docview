// Markdown preview for the side panel.
import DOMPurify from "dompurify";
import { Marked } from "marked";
import { LANG_BY_ID, languageFromFilename } from "./languages";
import { escapeHtml, highlight } from "./render";

/** Info-string names that are neither a language id nor a file extension. */
const ALIASES: Record<string, string> = {
  "c#": "csharp", "c-sharp": "csharp", shell: "bash", console: "bash", ps: "powershell",
  pwsh: "powershell", "t-sql": "sql", tsql: "sql", docker: "dockerfile", jsonc: "json",
};

/** Maps a fenced code block's info string ("ts", "json", "c#") to one of our language ids. */
export function codeLanguage(info: string | undefined): string {
  const name = (info ?? "").trim().split(/\s+/)[0].toLowerCase();
  if (!name) return "plaintext";
  if (LANG_BY_ID.has(name)) return name;
  if (ALIASES[name]) return ALIASES[name];
  return languageFromFilename(`x.${name}`) ?? "plaintext";
}

const marked = new Marked({
  gfm: true,
  renderer: {
    code({ text, lang }) {
      const id = codeLanguage(lang);
      const body = id === "plaintext" ? escapeHtml(text) : highlight(text, id);
      return `<pre><code class="hljs language-${id}">${body}</code></pre>\n`;
    },
  },
});

/**
 * Renders Markdown to HTML. The result is NOT safe yet: pasted text can contain
 * raw HTML and scripts, so it must go through `sanitize` before it is shown.
 */
export function markdownToHtml(text: string): string {
  return marked.parse(text, { async: false });
}

/** Markdown -> sanitized HTML (needs a DOM; scripts, event handlers and javascript: links are removed). */
export function renderMarkdown(text: string): string {
  return DOMPurify.sanitize(markdownToHtml(text), { USE_PROFILES: { html: true } });
}
