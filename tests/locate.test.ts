import { describe, expect, it } from "vitest";
import { findOffset, jsonLocations, lineOf, lineStarts, xmlLocations } from "../src/locate";

/** 0-based line of `path` in `text`. */
function lineFor(text: string, map: Map<string, number>, path: string, lang: "json" | "xml") {
  const off = findOffset(map, path, lang);
  return off === undefined ? undefined : lineOf(lineStarts(text), off);
}

describe("jsonLocations", () => {
  const text = `{
  "name": "DocView",
  "with space": [1, 2],
  "items": [
    { "id": 1, "tags": ["a", "b"] },
    {
      "id": 2,
      "esc\\"aped": "x\\ny"
    }
  ]
}`;
  const map = jsonLocations(text);
  const line = (p: string) => lineFor(text, map, p, "json");

  it("finds object members by their key", () => {
    expect(line("$")).toBe(0);
    expect(line("$.name")).toBe(1);
    expect(text.slice(map.get("$.name")!, map.get("$.name")! + 6)).toBe('"name"');
    expect(line('$["with space"]')).toBe(2);
    expect(line('$["with space"][1]')).toBe(2);
  });

  it("finds array items and nested values", () => {
    expect(line("$.items")).toBe(3);
    expect(line("$.items[0].tags[1]")).toBe(4);
    expect(line("$.items[1]")).toBe(5);
    expect(line("$.items[1].id")).toBe(6);
    expect(line('$.items[1]["esc\\"aped"]')).toBe(7);
  });

  it("falls back to the nearest known ancestor", () => {
    expect(line("$.items[1].missing")).toBe(5);
  });
});

describe("xmlLocations", () => {
  const text = `<?xml version="1.0"?>
<!-- <fake> -->
<orders count="2">
  <order id="1">
    <customer>Alice</customer>
  </order>
  <order
      id="2">
    <note><![CDATA[<b>]]></note>
    <empty/>
  </order>
</orders>`;
  const map = xmlLocations(text);
  const line = (p: string) => lineFor(text, map, p, "xml");

  it("finds elements with the tree's XPaths", () => {
    expect(line("/orders")).toBe(2);
    expect(line("/orders/order[1]")).toBe(3);
    expect(line("/orders/order[1]/customer")).toBe(4);
    expect(line("/orders/order[2]")).toBe(6);
    expect(line("/orders/order[2]/empty")).toBe(9);
  });

  it("finds attributes on their own line", () => {
    expect(line("/orders/@count")).toBe(2);
    expect(line("/orders/order[2]/@id")).toBe(7);
  });

  it("uses the parent element for text and CDATA", () => {
    expect(line("/orders/order[2]/note/text()")).toBe(8);
    expect(line("/orders/order[1]/customer/text()")).toBe(4);
  });

  it("ignores tags inside comments and CDATA", () => {
    expect(map.has("/fake")).toBe(false);
    expect(map.has("/orders/order[2]/note/b")).toBe(false);
  });
});

describe("lineOf", () => {
  it("maps offsets to 0-based lines", () => {
    const starts = lineStarts("ab\ncd\n\nef");
    expect([0, 2, 3, 6, 7, 8].map((o) => lineOf(starts, o))).toEqual([0, 0, 1, 2, 3, 3]);
  });
});
