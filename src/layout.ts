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

export const TOOLBAR_BREAKPOINTS = {
  hideLineCount: 1100,
  compact: 960,
  moreActions: 820,
  moreCopy: 720,
  viewMenu: 640,
  moreOpen: 560,
} as const;

export function toolbarLayout(width: number): ToolbarLayout {
  const b = TOOLBAR_BREAKPOINTS;
  return {
    hideLineCount: width < b.hideLineCount,
    compact: width < b.compact,
    moreActions: width < b.moreActions,
    moreCopy: width < b.moreCopy,
    viewMenu: width < b.viewMenu,
    moreOpen: width < b.moreOpen,
  };
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
