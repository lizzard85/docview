// Lucide icons (bundled, stroke width 2.75) as SVG markup.
import {
  ArrowDown, ArrowUp, Check, ChevronDown, ChevronUp, CircleAlert, CircleHelp, Clipboard, Copy, Download, Ellipsis, Eye,
  File, FolderOpen, GitCompare, History, Info, Minus, Palette, PanelRight, Plus, RotateCcw, Save, Search,
  SlidersHorizontal, Square, SquarePen, Undo2, X, type IconNode,
} from "lucide";

const ICONS = {
  "arrow-down": ArrowDown, "arrow-up": ArrowUp, check: Check, "chevron-down": ChevronDown, "chevron-up": ChevronUp,
  alert: CircleAlert, help: CircleHelp, clipboard: Clipboard, copy: Copy, download: Download, more: Ellipsis, eye: Eye,
  file: File, folder: FolderOpen, compare: GitCompare, history: History, info: Info, minus: Minus, palette: Palette,
  panel: PanelRight, plus: Plus, reset: RotateCcw, save: Save, search: Search, sliders: SlidersHorizontal,
  square: Square, editor: SquarePen, undo: Undo2, x: X,
} satisfies Record<string, IconNode>;

export type IconName = keyof typeof ICONS | "restore";

/** Two overlapping squares (window "restore"). */
const RESTORE: IconNode = [
  ["rect", { x: "8", y: "8", width: "12", height: "12", rx: "2.5" }],
  ["path", { d: "M16 8V6.5A2.5 2.5 0 0 0 13.5 4h-7A2.5 2.5 0 0 0 4 6.5v7A2.5 2.5 0 0 0 6.5 16H8" }],
];

function escapeAttr(v: string | number | undefined): string {
  return String(v ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

/** SVG markup of an icon at `size` px. */
export function icon(name: IconName, size = 16): string {
  const node = name === "restore" ? RESTORE : ICONS[name];
  const children = node
    .map(([tag, attrs]) => `<${tag} ${Object.entries(attrs).map(([k, v]) => `${k}="${escapeAttr(v)}"`).join(" ")}/>`)
    .join("");
  return `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${children}</svg>`;
}

/** Replaces every `<i data-icon="name" data-size="16">` placeholder below `root` with its SVG. */
export function renderIcons(root: ParentNode = document): void {
  for (const el of root.querySelectorAll<HTMLElement>("i[data-icon]")) {
    el.outerHTML = icon(el.dataset.icon as IconName, Number(el.dataset.size) || 16);
  }
}
