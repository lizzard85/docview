import { describe, expect, it } from "vitest";
import { codeLanguage, markdownToHtml } from "../src/markdown";

describe("codeLanguage", () => {
  it("maps info strings to language ids", () => {
    expect(codeLanguage("json")).toBe("json");
    expect(codeLanguage("ts")).toBe("typescript");
    expect(codeLanguage("C#")).toBe("csharp");
    expect(codeLanguage("sql title=query.sql")).toBe("sql");
    expect(codeLanguage("")).toBe("plaintext");
    expect(codeLanguage("nosuchlanguage")).toBe("plaintext");
  });
});

describe("markdownToHtml", () => {
  it("renders GitHub-flavoured Markdown", () => {
    const html = markdownToHtml("# Title\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n- [x] done\n");
    expect(html).toContain("<h1>Title</h1>");
    expect(html).toContain("<table>");
    expect(html).toContain('type="checkbox"');
  });

  it("highlights fenced code blocks", () => {
    const html = markdownToHtml('```json\n{"a": 1}\n```');
    expect(html).toContain('class="hljs language-json"');
    expect(html).toContain("hljs-attr");
  });

  it("escapes code in unknown languages", () => {
    expect(markdownToHtml("```\n<script>x</script>\n```")).toContain("&lt;script&gt;");
  });
});
