import { describe, expect, it } from "vitest";
import { diffTexts, inlineDiff, normalizeForCompare, sortKeys, stepChange } from "../src/compare";
import { DEFAULT_FORMAT_OPTIONS } from "../src/format";

const norm = (t: string, lang: string) => normalizeForCompare(t, lang, DEFAULT_FORMAT_OPTIONS);

describe("formatted comparison", () => {
  it("finds no changes when JSON only differs in key order and whitespace", async () => {
    const a = await norm('{"b": 1, "a": {"y": [1, 2], "x": null}}', "json");
    const b = await norm('{\n    "a": { "x": null,\n "y": [1,2] },\n  "b":1\n}', "json");
    const d = diffTexts(a, b);
    expect(d.changes).toEqual([]);
    expect(d.rows.every((r) => r.kind === "same")).toBe(true);
  });

  it("detects real changes in JSON", async () => {
    const a = await norm('{"id": 1, "name": "old", "tags": ["a"]}', "json");
    const b = await norm('{"name": "new", "id": 1, "tags": ["a", "b"]}', "json");
    const d = diffTexts(a, b);
    expect(d.changes.length).toBe(2);
    const changed = d.rows.filter((r) => r.kind !== "same");
    expect(changed.map((r) => r.kind)).toEqual(["changed", "changed", "added"]);
  });

  it("ignores formatting differences in SQL", async () => {
    const a = await norm("select a, b from t where x = 1", "sql");
    const b = await norm("SELECT a,\n  b\nFROM   t WHERE x=1", "sql");
    // Keywords keep their case by default, so compare lower-cased.
    expect(diffTexts(a.toLowerCase(), b.toLowerCase()).changes).toEqual([]);
  });

  it("compares invalid JSON as text", async () => {
    expect(await norm("{not json", "json")).toBe("{not json");
  });
});

describe("diffTexts", () => {
  it("pairs changed lines and pads added/removed lines", () => {
    const d = diffTexts("a\nb\nc\nd\n", "a\nB\nc\nx\ny\n");
    expect(d.rows.map((r) => [r.kind, r.left?.line, r.right?.line])).toEqual([
      ["same", 1, 1],
      ["changed", 2, 2],
      ["same", 3, 3],
      ["changed", 4, 4],
      ["added", undefined, 5],
    ]);
    expect(d.changes).toEqual([1, 3]);
  });

  it("handles removed lines and texts without final newline", () => {
    const d = diffTexts("a\nb\nc", "a\nc");
    expect(d.rows.map((r) => r.kind)).toEqual(["same", "removed", "same"]);
    expect(d.rows[1].left?.segments).toEqual([{ text: "b", changed: true }]);
  });

  it("treats CRLF and LF alike", () => {
    expect(diffTexts("a\r\nb\r\n", "a\nb\n").changes).toEqual([]);
  });
});

describe("inlineDiff", () => {
  it("marks changed characters on both sides", () => {
    const d = inlineDiff('  "name": "old",', '  "name": "new",');
    expect(d.left.filter((s) => s.changed).map((s) => s.text).join("")).toBe("old");
    expect(d.right.filter((s) => s.changed).map((s) => s.text).join("")).toBe("new");
    expect(d.left.map((s) => s.text).join("")).toBe('  "name": "old",');
    expect(d.right.map((s) => s.text).join("")).toBe('  "name": "new",');
  });
});

describe("helpers", () => {
  it("sorts keys recursively", () => {
    expect(JSON.stringify(sortKeys({ b: 1, a: [{ d: 1, c: 2 }] }))).toBe('{"a":[{"c":2,"d":1}],"b":1}');
  });

  it("steps through changes with wrap-around", () => {
    expect(stepChange([2, 8, 15], -1, 1)).toBe(2);
    expect(stepChange([2, 8, 15], 2, 1)).toBe(8);
    expect(stepChange([2, 8, 15], 15, 1)).toBe(2);
    expect(stepChange([2, 8, 15], 8, -1)).toBe(2);
    expect(stepChange([2, 8, 15], 2, -1)).toBe(15);
    expect(stepChange([], 0, 1)).toBeUndefined();
  });
});

describe("lenient JSON comparison", () => {
  it("normalizes JSON with raw line breaks inside strings", async () => {
    const a = await normalizeForCompare('{"b":"x\ny","a":1}', "json", DEFAULT_FORMAT_OPTIONS);
    expect(a).toBe(JSON.stringify({ a: 1, b: "x\ny" }, null, DEFAULT_FORMAT_OPTIONS.indent));
  });
});

describe("ignore whitespace", () => {
  it("treats lines that only differ in whitespace as the same", () => {
    const a = "a = 1\n  b(x, y)\nc";
    const b = "a=1\n\tb(x,y)  \nc";
    expect(diffTexts(a, b).changes.length).toBe(1);
    const d = diffTexts(a, b, { ignoreWhitespace: true });
    expect(d.changes).toEqual([]);
    // Each side keeps its own text.
    expect(d.rows[1].left!.segments[0].text).toBe("  b(x, y)");
    expect(d.rows[1].right!.segments[0].text).toBe("\tb(x,y)  ");
  });

  it("still finds real changes and does not mark whitespace in them", () => {
    const d = diffTexts("x = 1\nkeep", "x  =  2\nkeep", { ignoreWhitespace: true });
    expect(d.changes).toEqual([0]);
    expect(d.rows[0].kind).toBe("changed");
    const marked = d.rows[0].right!.segments.filter((s) => s.changed).map((s) => s.text);
    expect(marked.join("")).toBe("2");
  });

  it("keeps line numbers per side with added and removed lines", () => {
    const d = diffTexts("a\nb\nc", "a\n  c\nd", { ignoreWhitespace: true });
    expect(d.rows.map((r) => r.kind)).toEqual(["same", "removed", "same", "added"]);
    expect(d.rows[2].left!.line).toBe(3);
    expect(d.rows[2].right!.line).toBe(2);
  });
});
