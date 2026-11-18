import { describe, expect, it } from "vitest";
import { clampPanelWidth, hasMoreMenu, PANEL_OVERLAY_BELOW, panelIsOverlay, toolbarLayout } from "../src/layout";

describe("responsive toolbar", () => {
  it("shows everything from 1100px", () => {
    const l = toolbarLayout(1100);
    expect(Object.values(l).every((v) => v === false)).toBe(true);
    expect(hasMoreMenu(l)).toBe(false);
  });

  it("collapses in the documented order", () => {
    expect(toolbarLayout(1099)).toMatchObject({ hideLineCount: true, compact: false });
    expect(toolbarLayout(959)).toMatchObject({ compact: true, moreActions: false });
    expect(toolbarLayout(960).compact).toBe(false);
    expect(toolbarLayout(819)).toMatchObject({ moreActions: true, moreCopy: false });
    expect(toolbarLayout(719)).toMatchObject({ moreCopy: true, viewMenu: false });
    expect(toolbarLayout(639)).toMatchObject({ viewMenu: true, moreOpen: false });
    expect(toolbarLayout(559).moreOpen).toBe(true);
    expect(toolbarLayout(480)).toEqual({
      hideLineCount: true, compact: true, moreActions: true, moreCopy: true, viewMenu: true, moreOpen: true,
    });
  });

  it("has a … menu once actions move into it", () => {
    expect(hasMoreMenu(toolbarLayout(900))).toBe(false);
    expect(hasMoreMenu(toolbarLayout(800))).toBe(true);
  });
});

describe("side panel", () => {
  it("becomes an overlay below code + panel minimum + gap + padding", () => {
    expect(PANEL_OVERLAY_BELOW).toBe(320 + 260 + 12 + 32);
    expect(panelIsOverlay(623)).toBe(true);
    expect(panelIsOverlay(624)).toBe(false);
  });

  it("keeps the panel width between its minimum and what leaves the code 320px", () => {
    expect(clampPanelWidth(100, 1200)).toBe(260);
    expect(clampPanelWidth(430, 1200)).toBe(430);
    expect(clampPanelWidth(1000, 1200)).toBe(1200 - 320 - 12);
    expect(clampPanelWidth(500, 500)).toBe(260);
  });
});
