import { describe, expect, it } from "vitest";
import { colouredHtml, inlineStyles, tokenStyle } from "../src/richCopy";

describe("colouredHtml", () => {
  it("uses inline styles and no classes", () => {
    const html = colouredHtml("SELECT name FROM users WHERE id = 1 -- note", "sql");
    expect(html).not.toMatch(/class=/);
    expect(html).toMatch(/^<pre style="[^"]*font-family:Consolas[^"]*">/);
    expect(html).toContain('<span style="color:#0000ff">SELECT</span>');
    expect(html).toContain('<span style="color:#098658">1</span>');
    expect(html).toContain('<span style="color:#008000;font-style:italic">-- note</span>');
    expect(html.endsWith("</pre>")).toBe(true);
  });

  it("escapes the text", () => {
    const html = colouredHtml('<a href="x">&amp; </a>', "xml");
    expect(html).not.toMatch(/class=/);
    expect(html).toContain("&lt;");
    expect(html).not.toContain("<a ");
    expect(html).toContain("&amp;amp;");
    const plain = colouredHtml("1 < 2 && \"x\" > 'y'", "plaintext");
    expect(plain).toBe(`${plain.slice(0, plain.indexOf(">") + 1)}1 &lt; 2 &amp;&amp; &quot;x&quot; &gt; 'y'</pre>`);
  });

  it("keeps line breaks and indentation", () => {
    const html = colouredHtml('{\n  "a": 1\n}', "json");
    expect(html).toContain("\n  ");
    expect(html).toContain("white-space:pre");
  });

  it("colours JSON keys as variables", () => {
    expect(colouredHtml('{"a": "b"}', "json")).toContain('<span style="color:#001080">&quot;a&quot;</span>');
  });
});

describe("tokenStyle / inlineStyles", () => {
  it("maps scopes like the stylesheet", () => {
    expect(tokenStyle(["hljs-title", "class_"], "csharp")).toBe("color:#267f99");
    expect(tokenStyle(["hljs-title", "function_"], "js")).toBe("color:#795e26");
    expect(tokenStyle(["hljs-strong"], "markdown")).toBe("font-weight:bold");
    expect(tokenStyle(["hljs-punctuation"], "json")).toBe("");
  });

  it("colours keywords inside meta as meta and strips unknown classes", () => {
    const out = inlineStyles('<span class="hljs-meta">#<span class="hljs-keyword">if</span></span><span class="hljs-punctuation">,</span>', "csharp");
    expect(out).toBe('<span style="color:#af00db">#<span style="color:#af00db">if</span></span><span>,</span>');
  });
});
