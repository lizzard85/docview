// The side panel to the right of the code view (tree view of JSON, …).
import { filterTree, TreeView, type TreeNode } from "./tree";

export interface PanelView {
  title: string;
  /** Tree to show (JSON, XML). */
  nodes?: TreeNode[];
  /** Sanitized HTML to show (Markdown preview). */
  html?: string;
  /** Shown instead when the text could not be parsed. */
  error?: string;
}

const MIN_WIDTH = 200;

export class SidePanel {
  readonly tree: TreeView;
  /** Called when the user closes the panel or resizes it. */
  onClose: () => void = () => {};
  onResize: (width: number) => void = () => {};
  onCopy: (text: string, what: "path" | "value") => void = () => {};
  /** Called with the href of a link clicked in the HTML view. */
  onLink: (href: string) => void = () => {};

  private view: PanelView | null = null;
  private selected: TreeNode | null = null;
  private filterTimer: number | undefined;

  private readonly el = byId("side-panel");
  private readonly body = byId("panel-body");
  private readonly splitter = byId("splitter");
  private readonly title = byId("panel-title");
  private readonly filter = byId<HTMLInputElement>("panel-filter");
  private readonly path = byId("panel-path");
  private readonly copyPath = byId<HTMLButtonElement>("panel-copy-path");
  private readonly copyValue = byId<HTMLButtonElement>("panel-copy-value");

  constructor() {
    this.tree = new TreeView(this.body);
    this.tree.onSelect = (n) => this.onSelect(n);
    this.tree.onCopy = (n) => this.onCopy(n.copyValue(), "value");

    byId("panel-close").addEventListener("click", () => this.onClose());
    byId("panel-expand").addEventListener("click", () => {
      if (!this.tree.expandAll()) this.path.textContent = "Stopped expanding – the tree is very large.";
    });
    byId("panel-collapse").addEventListener("click", () => this.tree.collapseAll());
    this.copyPath.addEventListener("click", () => this.selected && this.onCopy(this.selected.path, "path"));
    this.copyValue.addEventListener("click", () => this.selected && this.onCopy(this.selected.copyValue(), "value"));

    this.filter.addEventListener("input", () => {
      clearTimeout(this.filterTimer);
      this.filterTimer = window.setTimeout(() => this.renderTree(), 200);
    });
    this.filter.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        if (this.filter.value) { this.filter.value = ""; this.renderTree(); }
        else this.tree.focus();
      } else if (e.key === "ArrowDown" || e.key === "Enter") {
        e.preventDefault();
        this.tree.focus();
      }
    });

    // Links in the HTML view must never navigate the app window.
    this.body.addEventListener("click", (e) => {
      const a = (e.target as HTMLElement).closest("a");
      if (!a) return;
      e.preventDefault();
      const href = a.getAttribute("href") ?? "";
      if (href.startsWith("#")) {
        document.getElementById(decodeURIComponent(href.slice(1)))?.scrollIntoView();
      } else if (href) this.onLink(a.href);
    });

    this.initSplitter();
  }

  get isOpen() { return !this.el.hidden; }

  setWidth(px: number) {
    this.el.style.width = `${Math.max(MIN_WIDTH, px)}px`;
  }

  /** Shows `view` when `open`; hides the panel when there is nothing to show. */
  update(view: PanelView | null, open: boolean) {
    const visible = !!view && open;
    this.el.hidden = !visible;
    this.splitter.hidden = !visible;
    if (!visible || view === this.view) {
      if (!view) this.view = null;
      return;
    }
    this.view = view;
    this.title.textContent = view.title;
    this.renderTree();
  }

  private renderTree() {
    const view = this.view;
    if (!view) return;
    const htmlMode = view.html !== undefined;
    this.el.classList.toggle("html-mode", htmlMode);
    this.body.classList.toggle("markdown-body", htmlMode);
    if (htmlMode) {
      this.body.innerHTML = view.html!;
      this.body.scrollTop = 0;
      return;
    }
    this.filter.disabled = !view.nodes;
    if (!view.nodes) {
      this.tree.showMessage(view.error ?? "Nothing to show.");
      return;
    }
    const q = this.filter.value.trim();
    if (!q) {
      this.tree.show(view.nodes, autoDepth(view.nodes));
      return;
    }
    const r = filterTree(view.nodes, q);
    if (!r.nodes.length) this.tree.showMessage(r.incomplete ? "No matches (search stopped – the tree is very large)." : "No matches.");
    else {
      this.tree.show(r.nodes, 0);
      if (r.incomplete) this.path.textContent = "Search stopped early – the tree is very large.";
    }
  }

  private onSelect(node: TreeNode | null) {
    this.selected = node;
    this.path.textContent = node ? node.path : "Select a node";
    this.path.title = node?.path ?? "";
    this.copyPath.disabled = this.copyValue.disabled = !node;
  }

  private initSplitter() {
    this.splitter.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      this.splitter.setPointerCapture(e.pointerId);
      const container = this.el.parentElement!;
      const move = (ev: PointerEvent) => {
        const rect = container.getBoundingClientRect();
        const width = Math.min(rect.right - ev.clientX, rect.width - MIN_WIDTH);
        this.setWidth(width);
      };
      const up = () => {
        this.splitter.removeEventListener("pointermove", move);
        this.splitter.removeEventListener("pointerup", up);
        this.onResize(this.el.getBoundingClientRect().width);
      };
      this.splitter.addEventListener("pointermove", move);
      this.splitter.addEventListener("pointerup", up);
    });
  }
}

/** Opens two levels for small trees, otherwise only the root. */
function autoDepth(nodes: TreeNode[]): number {
  const top = nodes.length === 1 ? nodes[0].childCount : nodes.length;
  return top <= 100 ? 2 : 1;
}

function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}
