import { describe, expect, it } from "vitest";
import { cellNumber, detectDelimiter, guessDelimiter, filterRows, isNumericColumn, parseCsv, sortRows } from "../src/csv";

describe("parseCsv", () => {
  it("parses simple rows and line numbers", () => {
    const r = parseCsv("a,b,c\n1,2,3\n4,5,6\n", ",");
    expect(r.rows).toEqual([["a", "b", "c"], ["1", "2", "3"], ["4", "5", "6"]]);
    expect(r.lines).toEqual([0, 1, 2]);
    expect(r.complete).toBe(true);
  });

  it("handles quotes, escaped quotes and delimiters inside quotes", () => {
    const r = parseCsv('name,quote\n"Smith, John","He said ""hi"""\n', ",");
    expect(r.rows[1]).toEqual(["Smith, John", 'He said "hi"']);
  });

  it("handles line breaks inside quoted fields and keeps line numbers right", () => {
    const r = parseCsv('id,text\r\n1,"line one\r\nline two"\r\n2,x\r\n', ",");
    expect(r.rows).toEqual([["id", "text"], ["1", "line one\r\nline two"], ["2", "x"]]);
    expect(r.lines).toEqual([0, 1, 3]);
  });

  it("keeps empty fields and handles a missing final newline", () => {
    expect(parseCsv("a;b;\n;2;3", ";").rows).toEqual([["a", "b", ""], ["", "2", "3"]]);
  });

  it("parses TSV", () => {
    expect(parseCsv("a\tb\n1\t2", "\t").rows).toEqual([["a", "b"], ["1", "2"]]);
  });

  it("reports an unterminated quote", () => {
    expect(parseCsv('a,"b\n1,2', ",").complete).toBe(false);
  });
});

describe("detectDelimiter", () => {
  it("detects comma, semicolon and tab", () => {
    expect(detectDelimiter("id,name,price\n1,Apple,1.5\n2,Pear,2\n")).toBe(",");
    expect(detectDelimiter("id;name;price\n1;Æble;1,5\n2;Pære;2,25\n")).toBe(";");
    expect(detectDelimiter("id\tname\n1\tApple\n")).toBe("\t");
    expect(detectDelimiter('id,text\n1,"a, b"\n2,"multi\nline"\n3,c\n')).toBe(",");
    expect(detectDelimiter("a,b,\n1,2,\n3,,4\n")).toBe(",");
  });

  it("rejects inconsistent rows, single columns and too few rows", () => {
    expect(detectDelimiter("a,b\n1,2,3\n4,5\n")).toBeNull();
    expect(detectDelimiter("just\nsome\nlines\n")).toBeNull();
    expect(detectDelimiter("a,b\n1,2\n")).toBeNull(); // two rows are not enough for commas
  });

  it("does not take code or prose for CSV", () => {
    expect(detectDelimiter("foo(a, b);\nbar(c, d);\nbaz(e, f);\n")).toBeNull();
    expect(detectDelimiter("print(a, b)\nprint(c, d)\nprint(e, f)\n")).toBeNull();
    expect(detectDelimiter("SELECT a;\nSELECT b;\nSELECT c;\n")).toBeNull();
    expect(detectDelimiter("color: red;\nmargin: 0;\npadding: 0;\n")).toBeNull();
    expect(detectDelimiter("Hello, world\nGoodbye, moon\nSee you, later\n")).toBeNull();
    expect(detectDelimiter("SELECT a, b\nFROM t\nWHERE x = 1")).toBeNull();
  });
});

describe("guessDelimiter", () => {
  it("uses the detected delimiter, else the most frequent one on the first line", () => {
    expect(guessDelimiter("a;b;c\n1;2;3\n4;5;6")).toBe(";");
    expect(guessDelimiter("a;b;c\n1;2\n")).toBe(";"); // ragged file
    expect(guessDelimiter("a\tb,c\tx\n")).toBe("\t");
    expect(guessDelimiter("single")).toBe(",");
  });
});

describe("numbers and sorting", () => {
  it("parses numbers as written in CSV files", () => {
    expect(cellNumber("42")).toBe(42);
    expect(cellNumber("-1.5")).toBe(-1.5);
    expect(cellNumber("1,5")).toBe(1.5);
    expect(cellNumber("1.234,5")).toBe(1234.5);
    expect(cellNumber("1,234.5")).toBe(1234.5);
    expect(cellNumber("1,234,567")).toBe(1234567);
    expect(cellNumber("1 000")).toBe(1000);
    expect(cellNumber("1e3")).toBe(1000);
    expect(cellNumber("1.2.3")).toBeNaN();
    expect(cellNumber("2024-01-01")).toBeNaN();
    expect(cellNumber("abc")).toBeNaN();
    expect(cellNumber("")).toBeNaN();
  });

  const rows = [["b", "10"], ["a", "9"], ["C", ""], ["a10", "100"], ["a2", "-1"]];

  it("detects numeric columns", () => {
    expect(isNumericColumn(rows, 1)).toBe(true);
    expect(isNumericColumn(rows, 0)).toBe(false);
    expect(isNumericColumn([["x"], [""]], 0)).toBe(false);
  });

  it("sorts numeric columns by value with empty cells last", () => {
    expect(sortRows(rows, 1, "asc").map((i) => rows[i][1])).toEqual(["-1", "9", "10", "100", ""]);
    expect(sortRows(rows, 1, "desc").map((i) => rows[i][1])).toEqual(["100", "10", "9", "-1", ""]);
  });

  it("sorts text naturally and case-insensitively", () => {
    expect(sortRows(rows, 0, "asc").map((i) => rows[i][0])).toEqual(["a", "a2", "a10", "b", "C"]);
  });

  it("filters rows on any cell", () => {
    const order = sortRows(rows, 0, "asc");
    expect(filterRows(rows, order, "A1").map((i) => rows[i][0])).toEqual(["a10"]);
    expect(filterRows(rows, order, "  ")).toBe(order);
  });
});
