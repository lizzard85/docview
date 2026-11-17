// "Copy with colours": highlighted code as HTML with inline styles, so the
// colours survive pasting into Outlook, Teams and Word. Those programs ignore
// CSS classes and stylesheets, so every token carries its own style.
//
// The light theme is always used: the pasted code usually ends up on a white
// page or e-mail, where dark-theme colours would be hard to read.
import { highlight } from "./render";

/** Light theme token colours (same values as the light theme in style.css). */
const C = {
  fg: "#1f2328",
  keyword: "#0000ff",
  string: "#a31515",
  number: "#098658",
  comment: "#008000",
  tag: "#800000",
  attr: "#e50000",
  title: "#795e26",
  type: "#267f99",
  builtin: "#0070c1",
  meta: "#af00db",
  variable: "#001080",
};

const SCOPE_COLOUR: Record<string, string> = {
  keyword: C.keyword, "selector-tag": C.keyword, literal: C.keyword, doctag: C.keyword, section: C.keyword,
  string: C.string, regexp: C.string, "selector-attr": C.string, "template-tag": C.string,
  number: C.number, symbol: C.number, bullet: C.number,
  comment: C.comment, quote: C.comment,
  tag: C.tag, name: C.tag, "selector-id": C.tag, "selector-class": C.tag,
  attr: C.attr, attribute: C.attr, property: C.attr, "selector-pseudo": C.attr,
  title: C.title,
  type: C.type,
  built_in: C.builtin,
  meta: C.meta,
  variable: C.variable, "template-variable": C.variable, params: C.variable,
  addition: C.number,
  deletion: C.string,
};

/**
 * Inline style for a highlight.js token. `classes` are the classes of the
 * span (e.g. ["hljs-title", "class_"]); `inMeta` is true inside a meta token.
 */
export function tokenStyle(classes: string[], lang: string, inMeta = false): string {
  const scopes = classes.filter((c) => c.startsWith("hljs-")).map((c) => c.slice(5));
  const has = (c: string) => classes.includes(c);
  const styles: string[] = [];
  let colour: string | undefined;
  for (const s of scopes) colour ??= SCOPE_COLOUR[s];
  if (scopes.includes("title") && has("class_")) colour = C.type;
  if (scopes.includes("attr") && lang === "json") colour = C.variable;
  if (scopes.includes("keyword") && inMeta) colour = C.meta;
  if (colour) styles.push(`color:${colour}`);
  if (scopes.some((s) => s === "comment" || s === "quote" || s === "emphasis")) styles.push("font-style:italic");
  if (scopes.includes("strong")) styles.push("font-weight:bold");
  if (scopes.includes("link")) styles.push("text-decoration:underline");
  return styles.join(";");
}

/** Replaces the class attributes of highlight.js spans with inline styles. */
export function inlineStyles(html: string, lang: string): string {
  const stack: boolean[] = []; // per open span: is it (inside) a meta token?
  return html.replace(/<span class="([^"]*)">|<\/span>/g, (tag, cls: string | undefined) => {
    if (cls === undefined) {
      stack.pop();
      return tag;
    }
    const classes = cls.split(/\s+/);
    const inMeta = stack.length > 0 && stack[stack.length - 1];
    stack.push(inMeta || classes.includes("hljs-meta"));
    const style = tokenStyle(classes, lang, inMeta);
    return style ? `<span style="${style}">` : "<span>";
  });
}

const PRE_STYLE = [
  "font-family:Consolas,'Cascadia Mono','DejaVu Sans Mono','Courier New',monospace",
  "font-size:10pt",
  `color:${C.fg}`,
  "background:#ffffff",
  "margin:0",
  "white-space:pre",
].join(";");

/** The text as highlighted HTML with inline styles only (no classes), in the light theme. */
export function colouredHtml(text: string, lang: string): string {
  const body = inlineStyles(highlight(text, lang), lang);
  return `<pre style="${PRE_STYLE}">${body}</pre>`;
}
