import { describe, expect, it } from "vitest";
import { convert, conversionsFor, jsonToXmlProblem } from "../src/convert";

describe("conversionsFor", () => {
  it("offers conversions by language", () => {
    expect(conversionsFor("json").map((c) => c.id)).toEqual(["json-yaml", "json-xml", "json-min"]);
    expect(conversionsFor("yaml").map((c) => c.to)).toEqual(["json"]);
    expect(conversionsFor("xml").map((c) => c.id)).toEqual(["xml-json", "xml-min"]);
    expect(conversionsFor("sql")).toEqual([]);
  });
});

describe("JSON ↔ YAML", () => {
  it("converts JSON with arrays to YAML", () => {
    const json = '{"name":"x","tags":["a","b"],"items":[{"id":1,"ok":true},{"id":2,"ok":null}]}';
    expect(convert("json-yaml", json)).toBe(
      ["name: x", "tags:", "  - a", "  - b", "items:", "  - id: 1", "    ok: true", "  - id: 2", "    ok: null"].join("\n"),
    );
  });

  it("converts YAML to JSON", () => {
    expect(convert("yaml-json", "a: 1\nlist:\n  - x\n  - 'y'\nnested:\n  b: true\n", 2)).toBe(
      '{\n  "a": 1,\n  "list": [\n    "x",\n    "y"\n  ],\n  "nested": {\n    "b": true\n  }\n}',
    );
  });

  it("round-trips", () => {
    const v = { a: [1, { b: "c" }], d: "multi\nline", e: "" };
    expect(JSON.parse(convert("yaml-json", convert("json-yaml", JSON.stringify(v))))).toEqual(v);
  });

  it("reports invalid YAML", () => {
    expect(() => convert("yaml-json", "a: [1, 2\nb: c")).toThrow();
  });
});

describe("XML → JSON", () => {
  it("maps attributes, text and repeated elements", () => {
    const xml = '<?xml version="1.0"?><orders><order id="1" status="new"><item>A</item><item>B</item><code>007</code></order><note lang="en">Hi</note></orders>';
    expect(JSON.parse(convert("xml-json", xml))).toEqual({
      orders: {
        order: { "@id": "1", "@status": "new", item: ["A", "B"], code: "007" },
        note: { "@lang": "en", "#text": "Hi" },
      },
    });
  });

  it("reports malformed XML", () => {
    expect(() => convert("xml-json", "<a><b></a>")).toThrow(/not well-formed/);
  });
});

describe("JSON → XML", () => {
  it("builds XML with attributes and repeated elements", () => {
    const json = JSON.stringify({ orders: { order: [{ "@id": "1", item: "A" }, { "@id": "2", item: "B & C" }] } });
    expect(convert("json-xml", json)).toBe(
      ['<orders>', '  <order id="1">', '    <item>A</item>', '  </order>', '  <order id="2">', '    <item>B &amp; C</item>', '  </order>', '</orders>'].join("\n"),
    );
  });

  it("wraps several top-level keys in <root>", () => {
    expect(convert("json-xml", '{"a":1,"b":"x"}')).toBe("<root>\n  <a>1</a>\n  <b>x</b>\n</root>");
  });

  it("round-trips through XML → JSON", () => {
    const xml = '<cfg version="2">\n  <item key="a">1</item>\n  <item key="b">2</item>\n</cfg>';
    expect(convert("json-xml", convert("xml-json", xml))).toBe(xml);
  });

  it("refuses JSON that does not map cleanly", () => {
    expect(jsonToXmlProblem([1, 2])).toMatch(/object at the top/);
    expect(jsonToXmlProblem({ "first name": 1 })).toMatch(/not a valid XML name/);
    expect(jsonToXmlProblem({ a: [[1, 2]] })).toMatch(/arrays inside arrays/);
    expect(jsonToXmlProblem({ a: { "@id": { x: 1 } } })).toMatch(/attribute/);
    expect(jsonToXmlProblem({ a: { b: [1, 2], "@id": "x" } })).toBeNull();
    expect(() => convert("json-xml", '{"1abc": true}')).toThrow(/Cannot convert to XML/);
  });
});

describe("minify", () => {
  it("minifies JSON, also with comments", () => {
    expect(convert("json-min", '{\n  "a": 1, // one\n  "b": [1, 2,],\n}')).toBe('{"a":1,"b":[1,2]}');
  });

  it("minifies XML", () => {
    expect(convert("xml-min", "<a>\n  <b x=\"1\">text</b>\n  <c/>\n</a>\n")).toBe('<a><b x="1">text</b><c/></a>');
  });
});

describe("lenient JSON input", () => {
  it("converts JSON with raw line breaks inside strings (Business Central)", () => {
    const bc = '{"name":"it\nu2019s","note":"a\nb"}';
    expect(convert("json-min", bc)).toBe(JSON.stringify({ name: "it’s", note: "a\nb" }));
  });
});
