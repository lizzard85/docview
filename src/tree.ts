// Generic tree view for the side panel (JSON, XML). Children are built and
// rendered only when a node is expanded, so large documents stay responsive.

export interface TreeNode {
  key: string;
  keyClass?: string;
  /** Shown after the key for leaf nodes (already shortened for display). */
  value?: string;
  valueClass?: string;
  /** Muted text after the key, e.g. "{3 keys}". */
  summary?: string;
  /** Path shown in the footer and copied with "Copy path". */
  path: string;
  childCount: number;
  children?: () => TreeNode[];
  copyValue: () => string;
  /** Lower-case text the filter matches against. */
  searchText: string;
  /** Expanded when shown (used by the filter to reveal matches). */
  open?: boolean;
}

/** Children are rendered in chunks of this size ("Show more" for the rest). */
const CHUNK = 500;
/** "Expand all" stops after this many rows. */
const EXPAND_ALL_LIMIT = 5000;
/** Display length for long values; "Copy value" still copies everything. */
export const MAX_VALUE_CHARS = 300;

export function shorten(s: string): string {
  return s.length > MAX_VALUE_CHARS ? s.slice(0, MAX_VALUE_CHARS) + "…" : s;
}

export interface FilterResult {
  nodes: TreeNode[];
  /** True if the filter gave up before visiting every node. */
  incomplete: boolean;
}

/**
 * Keeps the nodes that match `query` and the ancestors of matches. Ancestors
 * are opened so the matches are visible. Visits at most `maxNodes` nodes.
 */
export function filterTree(nodes: TreeNode[], query: string, maxNodes = 200_000): FilterResult {
  const q = query.toLowerCase();
  const budget = { left: maxNodes };
  const walk = (list: TreeNode[]): TreeNode[] => {
    const out: TreeNode[] = [];
    for (const n of list) {
      if (budget.left-- <= 0) break;
      const kids = n.children ? walk(n.children()) : [];
      if (kids.length) out.push({ ...n, children: () => kids, childCount: kids.length, open: true });
      else if (n.searchText.includes(q)) out.push({ ...n, open: false });
    }
    return out;
  };
  const result = walk(nodes);
  return { nodes: result, incomplete: budget.left < 0 };
}

export class TreeView {
  private selectedRow: HTMLElement | null = null;
  private readonly nodeOf = new WeakMap<HTMLElement, TreeNode>();
  onSelect: (node: TreeNode | null) => void = () => {};
  onCopy: (node: TreeNode) => void = () => {};

  constructor(private readonly root: HTMLElement) {
    root.tabIndex = 0;
    root.addEventListener("click", (e) => this.onClick(e));
    root.addEventListener("keydown", (e) => this.onKey(e));
  }

  /** Shows `nodes`; levels above `autoDepth` start expanded. */
  show(nodes: TreeNode[], autoDepth = 1) {
    this.root.replaceChildren();
    this.select(null);
    this.appendItems(this.root, nodes, 0, autoDepth, 0);
  }

  showMessage(text: string) {
    const p = document.createElement("p");
    p.className = "tree-message";
    p.textContent = text;
    this.root.replaceChildren(p);
    this.select(null);
  }

  /** Expands everything, up to a limit. Returns false if it stopped early. */
  expandAll(): boolean {
    let rows = this.root.querySelectorAll(".tree-row").length;
    const queue = [...this.root.querySelectorAll<HTMLElement>(":scope > .tree-item")];
    while (queue.length) {
      const item = queue.shift()!;
      const kids = item.querySelector<HTMLElement>(":scope > .tree-children");
      if (!kids) continue;
      const wasEmpty = !kids.hasChildNodes();
      this.setOpen(item, true);
      if (wasEmpty) rows += kids.querySelectorAll(":scope > .tree-item").length;
      if (rows > EXPAND_ALL_LIMIT) return false;
      queue.push(...kids.querySelectorAll<HTMLElement>(":scope > .tree-item"));
    }
    return true;
  }

  collapseAll() {
    for (const item of this.root.querySelectorAll<HTMLElement>(".tree-item")) this.setOpen(item, false);
    if (this.selectedRow && !this.isVisible(this.selectedRow)) this.select(null);
  }

  focus() { this.root.focus(); }

  // ---------------------------------------------------------------- rendering

  private appendItems(container: HTMLElement, nodes: TreeNode[], depth: number, autoDepth: number, start: number) {
    const end = Math.min(nodes.length, start + CHUNK);
    const frag = document.createDocumentFragment();
    for (let i = start; i < end; i++) frag.append(this.createItem(nodes[i], depth, autoDepth));
    if (end < nodes.length) {
      const more = document.createElement("div");
      more.className = "tree-row tree-more";
      more.style.paddingLeft = `${depth * 14 + 4}px`;
      more.textContent = `Show more (${nodes.length - end} remaining)`;
      more.addEventListener("click", (e) => {
        e.stopPropagation();
        more.remove();
        this.appendItems(container, nodes, depth, autoDepth, end);
      });
      frag.append(more);
    }
    container.append(frag);
  }

  private createItem(node: TreeNode, depth: number, autoDepth: number): HTMLElement {
    const item = document.createElement("div");
    item.className = "tree-item";
    const row = document.createElement("div");
    row.className = "tree-row";
    row.style.paddingLeft = `${depth * 14 + 4}px`;
    this.nodeOf.set(row, node);

    const caret = document.createElement("span");
    caret.className = "tree-caret";
    caret.textContent = node.childCount ? "▸" : "";
    row.append(caret, span(node.key, node.keyClass ?? "tree-key"));
    if (node.value !== undefined) row.append(span(": ", "tree-sep"), span(node.value, node.valueClass ?? ""));
    if (node.summary) row.append(span(node.summary, "tree-summary"));
    item.append(row);

    if (node.childCount && node.children) {
      const kids = document.createElement("div");
      kids.className = "tree-children";
      kids.hidden = true;
      item.append(kids);
      // Children are created on first expand.
      (item as ItemElement).lazy = { node, depth, autoDepth };
      if (node.open ?? depth < autoDepth) this.setOpen(item, true);
    }
    return item;
  }

  private setOpen(item: HTMLElement, open: boolean) {
    const kids = item.querySelector<HTMLElement>(":scope > .tree-children");
    if (!kids) return;
    const lazy = (item as ItemElement).lazy;
    if (open && lazy && !kids.hasChildNodes()) {
      this.appendItems(kids, lazy.node.children!(), lazy.depth + 1, lazy.autoDepth, 0);
    }
    kids.hidden = !open;
    const caret = item.querySelector(":scope > .tree-row > .tree-caret");
    if (caret) caret.textContent = open ? "▾" : "▸";
  }

  private isOpen(item: HTMLElement): boolean {
    const kids = item.querySelector<HTMLElement>(":scope > .tree-children");
    return !!kids && !kids.hidden;
  }

  // ---------------------------------------------------------------- interaction

  private select(row: HTMLElement | null) {
    this.selectedRow?.classList.remove("selected");
    this.selectedRow = row;
    row?.classList.add("selected");
    row?.scrollIntoView({ block: "nearest" });
    this.onSelect(row ? this.nodeOf.get(row) ?? null : null);
  }

  private onClick(e: MouseEvent) {
    const row = (e.target as HTMLElement).closest<HTMLElement>(".tree-row");
    if (!row || row.classList.contains("tree-more")) return;
    const item = row.parentElement!;
    if ((e.target as HTMLElement).classList.contains("tree-caret") || e.detail === 2) {
      this.setOpen(item, !this.isOpen(item));
    }
    this.select(row);
  }

  private visibleRows(): HTMLElement[] {
    return [...this.root.querySelectorAll<HTMLElement>(".tree-row:not(.tree-more)")].filter((r) => this.isVisible(r));
  }

  private isVisible(row: HTMLElement): boolean {
    return row.offsetParent !== null;
  }

  private onKey(e: KeyboardEvent) {
    const row = this.selectedRow;
    const item = row?.parentElement;
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === "c" && row && !window.getSelection()?.toString()) {
      e.preventDefault();
      e.stopPropagation();
      this.onCopy(this.nodeOf.get(row)!);
      return;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const rows = this.visibleRows();
      const i = row ? rows.indexOf(row) : -1;
      const next = rows[e.key === "ArrowDown" ? Math.min(rows.length - 1, i + 1) : Math.max(0, i - 1)];
      if (next) this.select(next);
    } else if (e.key === "ArrowRight" && item) {
      e.preventDefault();
      if (!this.isOpen(item)) this.setOpen(item, true);
      else {
        const first = item.querySelector<HTMLElement>(":scope > .tree-children > .tree-item > .tree-row");
        if (first) this.select(first);
      }
    } else if (e.key === "ArrowLeft" && item) {
      e.preventDefault();
      if (this.isOpen(item)) this.setOpen(item, false);
      else {
        const parentRow = item.parentElement?.closest(".tree-item")?.querySelector<HTMLElement>(":scope > .tree-row");
        if (parentRow) this.select(parentRow);
      }
    } else if (e.key === "Enter" && item) {
      e.preventDefault();
      this.setOpen(item, !this.isOpen(item));
    }
  }
}

type ItemElement = HTMLElement & { lazy?: { node: TreeNode; depth: number; autoDepth: number } };

function span(text: string, className: string): HTMLSpanElement {
  const s = document.createElement("span");
  if (className) s.className = className;
  s.textContent = text;
  return s;
}
