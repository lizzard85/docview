import { describe, expect, it } from "vitest";
import {
  clampFontSize, FONT_DEFAULT, FONT_MAX, FONT_MIN, gutterChars, lineHeight, panelFontSize, panelRowHeight, zoomFontSize,
} from "../src/fontScale";

describe("font size scale", () => {
  it("computes the line height as round(size × 1.63)", () => {
    expect(lineHeight(11)).toBe(18);
    expect(lineHeight(13.5)).toBe(22);
    expect(lineHeight(16)).toBe(26);
    expect(lineHeight(20)).toBe(33);
  });

  it("clamps stored sizes into 10–24 and falls back to the default", () => {
    expect(clampFontSize(8)).toBe(FONT_MIN);
    expect(clampFontSize(40)).toBe(FONT_MAX);
    expect(clampFontSize(14)).toBe(14);
    expect(clampFontSize("15")).toBe(15);
    expect(clampFontSize(undefined)).toBe(FONT_DEFAULT);
    expect(clampFontSize("abc")).toBe(FONT_DEFAULT);
    expect(clampFontSize(0)).toBe(FONT_DEFAULT);
  });

  it("zooms in 1px steps within the range and resets to 13.5", () => {
    expect(zoomFontSize(13.5, 1)).toBe(14.5);
    expect(zoomFontSize(13.5, -1)).toBe(12.5);
    expect(zoomFontSize(24, 1)).toBe(24);
    expect(zoomFontSize(10.5, -1)).toBe(10);
    expect(zoomFontSize(18, 0)).toBe(FONT_DEFAULT);
    expect(zoomFontSize(40, -1)).toBe(23);
  });

  it("derives the tree/table size and row height", () => {
    expect(panelFontSize(13.5)).toBe(13);
    expect(panelRowHeight(13.5)).toBe(lineHeight(13) + 6);
  });

  it("sizes the gutter as digits + 1", () => {
    expect(gutterChars(1)).toBe(2);
    expect(gutterChars(9)).toBe(2);
    expect(gutterChars(10)).toBe(3);
    expect(gutterChars(5546)).toBe(5);
    expect(gutterChars(0)).toBe(2);
  });
});
