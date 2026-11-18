// Responsive layout rules (pure): what the toolbar collapses at a given window
// width, and when the side panel becomes an overlay.

export interface ToolbarLayout {
  /** < 1100: the line count is hidden (shown in the "…" menu header). */
  hideLineCount: boolean;
  /** < 960: Copy, Open and "recognized" show icons only. */
  compact: boolean;
  /** < 820: History, Compare, Editor, Save and Convert move into "…". */
  moreActions: boolean;
  /** < 720: Copy (and Copy colours) move into "…". */
  moreCopy: boolean;
  /** < 640: Format, Wrap and Line no. collapse into "View ▾". */
  viewMenu: boolean;
  /** < 560: Open moves into "…" and Paste is icon-only. */
  moreOpen: boolean;
}

/** Window widths below which each collapse step applies, in collapse order. */
export const TOOLBAR_BREAKPOINTS = [1100, 960, 820, 720, 640, 560] as const;

/** Number of collapse steps that apply at a window width (0 = everything visible). */
export function toolbarLevel(width: number): number {
  return TOOLBAR_BREAKPOINTS.filter((b) => width < b).length;
}

/** The toolbar with the first `level` collapse steps applied (0–6). */
export function layoutForLevel(level: number): ToolbarLayout {
  return {
    hideLineCount: level >= 1,
    compact: level >= 2,
    moreActions: level >= 3,
    moreCopy: level >= 4,
    viewMenu: level >= 5,
    moreOpen: level >= 6,
  };
}

export const MAX_TOOLBAR_LEVEL = TOOLBAR_BREAKPOINTS.length;

export function toolbarLayout(width: number): ToolbarLayout {
  return layoutForLevel(toolbarLevel(width));
}

/** Whether the "…" menu has anything to show. */
export function hasMoreMenu(l: ToolbarLayout): boolean {
  return l.moreActions || l.moreCopy || l.moreOpen;
}

export const MIN_CODE_WIDTH = 320;
export const MIN_PANEL_WIDTH = 260;
/** Gap between the code card and the panel (the splitter). */
export const PANEL_GAP = 12;
/** Horizontal window padding (16px on each side). */
export const WINDOW_PADDING = 32;

/** Below this window width the side panel is an overlay sheet instead of a column. */
export const PANEL_OVERLAY_BELOW = MIN_CODE_WIDTH + MIN_PANEL_WIDTH + PANEL_GAP + WINDOW_PADDING;

export function panelIsOverlay(width: number): boolean {
  return width < PANEL_OVERLAY_BELOW;
}

/**
 * The panel width to use for a stored width in a main area of `available`
 * pixels: at least the panel minimum, and leaving the code its minimum.
 */
export function clampPanelWidth(width: number, available: number): number {
  const max = Math.max(MIN_PANEL_WIDTH, available - MIN_CODE_WIDTH - PANEL_GAP);
  return Math.round(Math.min(max, Math.max(MIN_PANEL_WIDTH, width)));
}
