import { describe, expect, it } from "vitest";
import { extensionFor, saveFilters, suggestFileName, suggestPath, withLineEndings } from "../src/save";

describe("save", () => {
  it("suggests snippet.<ext> for pasted text", () => {
    expect(suggestFileName(undefined, "json")).toBe("snippet.json");
    expect(suggestFileName(undefined, "sql")).toBe("snippet.sql");
    expect(suggestFileName("", "plaintext")).toBe("snippet.txt");
    expect(suggestFileName(undefined, "nope")).toBe("snippet.txt");
  });

  it("keeps the file name of an opened file", () => {
    expect(suggestFileName("orders.xml", "xml")).toBe("orders.xml");
    expect(suggestFileName("C:\\data\\orders.xml", "xml")).toBe("orders.xml");
    expect(suggestFileName("README", "markdown")).toBe(`README.${extensionFor("markdown")}`);
  });

  it("suggests a path next to the opened file", () => {
    expect(suggestPath("C:\\data\\a.json", "a.json", "json")).toBe("C:\\data\\a.json");
    expect(suggestPath("/home/me/a.yaml", "a.json", "json")).toBe("/home/me/a.json");
    expect(suggestPath(undefined, undefined, "sql")).toBe("snippet.sql");
  });

  it("offers the language filter first, then all files", () => {
    expect(saveFilters("json")).toEqual([{ name: "JSON", extensions: ["json"] }, { name: "All files", extensions: ["*"] }]);
    expect(saveFilters("plaintext")[0]).toEqual({ name: "Text", extensions: ["txt"] });
  });

  it("normalises line endings", () => {
    expect(withLineEndings("a\r\nb\rc\nd", false)).toBe("a\nb\nc\nd");
    expect(withLineEndings("a\nb\r\nc", true)).toBe("a\r\nb\r\nc");
  });
});
