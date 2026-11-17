import { describe, expect, it } from "vitest";
import {
  addToHistory, byteSize, capHistory, makePreview, parseHistory, relativeTime,
  MAX_ENTRIES, MAX_ENTRY_BYTES, MAX_TOTAL_BYTES, type HistoryEntry,
} from "../src/history";

const add = (list: HistoryEntry[], text: string, time: number, name?: string) =>
  addToHistory(list, { text, name, lang: "plaintext", time });

describe("addToHistory", () => {
  it("adds newest first", () => {
    let h: HistoryEntry[] = [];
    h = add(h, "one", 1);
    h = add(h, "two", 2);
    expect(h.map((e) => e.text)).toEqual(["two", "one"]);
    expect(h[0]).toEqual({ time: 2, text: "two", lang: "plaintext", preview: "two" });
  });

  it("does not duplicate identical content but moves it to the top", () => {
    let h = add(add([], "a", 1), "b", 2);
    h = add(h, "b", 3);
    expect(h.map((e) => [e.text, e.time])).toEqual([["b", 3], ["a", 1]]);
    h = add(h, "a", 4);
    expect(h.map((e) => e.text)).toEqual(["a", "b"]);
  });

  it("treats the same text from another file as a different entry", () => {
    const h = add(add([], "x", 1, "a.sql"), "x", 2, "b.sql");
    expect(h.map((e) => e.name)).toEqual(["b.sql", "a.sql"]);
  });

  it("skips empty and oversized content", () => {
    const h = add([], "a", 1);
    expect(add(h, "  \n ", 2)).toBe(h);
    expect(add(h, "x".repeat(MAX_ENTRY_BYTES + 1), 2)).toBe(h);
  });

  it("caps the number of entries, dropping the oldest", () => {
    let h: HistoryEntry[] = [];
    for (let i = 0; i < MAX_ENTRIES + 5; i++) h = add(h, `t${i}`, i);
    expect(h).toHaveLength(MAX_ENTRIES);
    expect(h[0].text).toBe(`t${MAX_ENTRIES + 4}`);
    expect(h[h.length - 1].text).toBe("t5");
  });

  it("caps the total size", () => {
    const big = (i: number) => `${i}`.padEnd(MAX_ENTRY_BYTES - 10, "x");
    let h: HistoryEntry[] = [];
    for (let i = 0; i < 15; i++) h = add(h, big(i), i);
    const total = h.reduce((n, e) => n + byteSize(e.text), 0);
    expect(total).toBeLessThanOrEqual(MAX_TOTAL_BYTES);
    expect(h.length).toBe(10);
    expect(h[0].text).toBe(big(14));
  });
});

describe("helpers", () => {
  it("measures UTF-8 size", () => {
    expect(byteSize("abc")).toBe(3);
    expect(byteSize("æøå")).toBe(6);
    expect(byteSize("€")).toBe(3);
    expect(byteSize("😀")).toBe(4);
  });

  it("makes a one-line preview", () => {
    expect(makePreview("\n\n   SELECT   *\n  FROM t")).toBe("SELECT *");
    expect(makePreview("x".repeat(200))).toHaveLength(80);
    expect(makePreview("x".repeat(200)).endsWith("…")).toBe(true);
  });

  it("validates stored data", () => {
    expect(parseHistory(null)).toEqual([]);
    expect(parseHistory({})).toEqual([]);
    const h = parseHistory([
      { time: 1, text: "old", lang: "sql", preview: "old" },
      { time: "x", text: "bad" },
      { time: 5, text: "new\nline", name: "a.json" },
      null,
    ]);
    expect(h).toEqual([
      { time: 5, text: "new\nline", name: "a.json", lang: "plaintext", preview: "new" },
      { time: 1, text: "old", lang: "sql", preview: "old" },
    ]);
  });

  it("formats relative times", () => {
    const now = 1_000_000_000_000;
    expect(relativeTime(now - 10_000, now)).toBe("just now");
    expect(relativeTime(now - 5 * 60_000, now)).toBe("5 min ago");
    expect(relativeTime(now - 3 * 3_600_000, now)).toBe("3 h ago");
    expect(relativeTime(now - 25 * 3_600_000, now)).toBe("yesterday");
    expect(relativeTime(now - 3 * 86_400_000, now)).toBe("3 days ago");
  });

  it("capHistory keeps order", () => {
    const list = [3, 2, 1].map((t) => ({ time: t, text: `${t}`, lang: "plaintext", preview: "" }));
    expect(capHistory(list).map((e) => e.time)).toEqual([3, 2, 1]);
  });
});
