import { describe, expect, it } from "vitest";
import { dedent, formatCode } from "../src/format";

describe("formatCode", () => {
  it("formats JSON", async () => {
    const r = await formatCode(`{"a":1,"b":[1,2]}`, "json");
    expect(r.formatted).toBe(true);
    expect(r.text).toBe(`{\n  "a": 1,\n  "b": [\n    1,\n    2\n  ]\n}`);
  });

  it("formats SQL", async () => {
    const r = await formatCode(`select a, b from t where x = 1 order by a`, "sql");
    expect(r.formatted).toBe(true);
    expect(r.text).toContain("\nfrom\n");
    expect(r.text.split("\n").length).toBeGreaterThan(4);
  });

  it("formats an XML fragment with several roots", async () => {
    const r = await formatCode(`<a><b>1</b></a><c/>`, "xml");
    expect(r.formatted).toBe(true);
    expect(r.text).toBe(`<a>\n  <b>1</b>\n</a>\n<c />`);
  });

  it("formats an HTML fragment", async () => {
    const r = await formatCode(`<div class="x"><span>Hej</span><ul><li>1</li><li>2</li></ul></div>`, "html");
    expect(r.formatted).toBe(true);
    expect(r.text.split("\n").length).toBeGreaterThan(3);
  });

  it("formats CSS", async () => {
    const r = await formatCode(`.a{color:red;margin:0}`, "css");
    expect(r.text).toBe(`.a {\n  color: red;\n  margin: 0;\n}`);
  });

  it("keeps invalid input and reports an error", async () => {
    const r = await formatCode(`{"a": }`, "json");
    expect(r.formatted).toBe(false);
    expect(r.error).toBeTruthy();
    expect(r.text).toBe(`{"a": }`);
  });

  it("leaves unformattable languages as-is (dedented)", async () => {
    const r = await formatCode(`    int x = 1;\n    int y = 2;`, "csharp");
    expect(r.text).toBe(`int x = 1;\nint y = 2;`);
  });
});

describe("dedent", () => {
  it("removes common indentation and blank edges", () => {
    expect(dedent(`\n    a\n      b\n`)).toBe(`a\n  b`);
  });
});
