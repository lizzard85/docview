import { describe, expect, it } from "vitest";
import { highlightCsv, renderCode, splitHtmlLines } from "../src/render";

describe("splitHtmlLines", () => {
  it("closes and reopens spans across lines", () => {
    const lines = splitHtmlLines(`a<span class="c">/* x\ny */</span>b`);
    expect(lines).toEqual([`a<span class="c">/* x</span>`, `<span class="c">y */</span>b`]);
  });
});

describe("renderCode", () => {
  it("escapes plain text and numbers lines", () => {
    const html = renderCode("<b>\nx", "plaintext");
    expect(html).toContain("&lt;b&gt;");
    expect(html.match(/class="line"/g)).toHaveLength(2);
  });
});

describe("highlightCsv", () => {
  it("colours the header row and the delimiters", () => {
    const html = highlightCsv("id,name\n1,Ada", ",");
    expect(html).toBe(
      '<span class="hljs-attr">id</span><span class="hljs-punctuation">,</span><span class="hljs-attr">name</span>\n' +
        '1<span class="hljs-punctuation">,</span>Ada',
    );
  });

  it("keeps delimiters and line breaks inside quotes", () => {
    const html = highlightCsv('a\tb\n"x\ty"\t"1\n2"', "\t");
    expect(html.split('class="hljs-punctuation"').length - 1).toBe(2);
    expect(html).toContain('&quot;x\ty&quot;');
    expect(html).toContain('&quot;1\n2&quot;');
  });

  it("escapes HTML", () => {
    expect(highlightCsv("<a>\n<b>", ",")).toBe('<span class="hljs-attr">&lt;a&gt;</span>\n&lt;b&gt;');
  });
});
