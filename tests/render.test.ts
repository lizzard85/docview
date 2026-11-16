import { describe, expect, it } from "vitest";
import { renderCode, splitHtmlLines } from "../src/render";

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
