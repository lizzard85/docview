import { describe, expect, it } from "vitest";
import { escapeControlCharsInStrings, parseJsonLenient } from "../src/json";
import { detectLanguage } from "../src/detect";
import { formatCode } from "../src/format";

// JSON copied from a Business Central Message() dialog: every backslash became a line break.
const BC = `{"no":32902,"lines":[{"description":"Joy\nu2019s All Greek To Me 15ml","qty":30},{"description":"Nail\r\nu2122 Strengthener","qty":20}]}`;

describe("escapeControlCharsInStrings", () => {
  it("restores \\uXXXX escapes broken by a line break", () => {
    expect(JSON.parse(escapeControlCharsInStrings(BC)).lines[0].description).toBe("Joy\u2019s All Greek To Me 15ml");
    expect(JSON.parse(escapeControlCharsInStrings(BC)).lines[1].description).toBe("Nail\u2122 Strengthener");
  });

  it("escapes other raw control characters inside strings", () => {
    const fixed = escapeControlCharsInStrings(`{"a":"x\ny\tz\u0001"}`);
    expect(JSON.parse(fixed)).toEqual({ a: "x\ny\tz\u0001" });
  });

  it("leaves whitespace outside strings and existing escapes alone", () => {
    const s = `{\n  "a": "q\\"\\n",\n\t"b": 1\n}`;
    expect(escapeControlCharsInStrings(s)).toBe(s);
  });
});

describe("parseJsonLenient", () => {
  it("parses valid JSON without repair", () => {
    expect(parseJsonLenient(`{"a":1}`)).toEqual({ value: { a: 1 }, repaired: false });
  });

  it("repairs strings with raw line breaks", () => {
    const r = parseJsonLenient(BC);
    expect(r.repaired).toBe(true);
    expect((r.value as { no: number }).no).toBe(32902);
  });

  it("throws the original error for broken JSON", () => {
    expect(() => parseJsonLenient(`{"a":`)).toThrow();
  });
});

describe("JSON with raw line breaks in strings", () => {
  it("is detected as JSON", () => {
    expect(detectLanguage(BC)).toEqual({ lang: "json", source: "parsed" });
  });

  it("is formatted with a warning", async () => {
    const r = await formatCode(BC, "json");
    expect(r.formatted).toBe(true);
    expect(r.warning).toBeTruthy();
    expect(r.text).toContain('"description": "Joy\u2019s All Greek To Me 15ml"');
  });
});
