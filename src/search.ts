// In-view search using the CSS Custom Highlight API (no DOM changes).

type HighlightRegistry = Map<string, Highlight>;

function registry(): HighlightRegistry | undefined {
  return (CSS as unknown as { highlights?: HighlightRegistry }).highlights;
}

export class Search {
  private matches: Range[] = [];
  private current = -1;

  constructor(
    private root: HTMLElement,
    private bar: HTMLElement,
    private input: HTMLInputElement,
    private count: HTMLElement,
  ) {
    input.addEventListener("input", () => this.run());
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); this.step(e.shiftKey ? -1 : 1); }
    });
    bar.querySelector("#search-next")?.addEventListener("click", () => this.step(1));
    bar.querySelector("#search-prev")?.addEventListener("click", () => this.step(-1));
    bar.querySelector("#search-close")?.addEventListener("click", () => this.close());
  }

  get isOpen() { return !this.bar.hidden; }

  open() {
    this.bar.hidden = false;
    const sel = window.getSelection()?.toString();
    if (sel && !sel.includes("\n")) this.input.value = sel;
    this.input.focus();
    this.input.select();
    this.run();
  }

  close() {
    this.bar.hidden = true;
    this.clear();
    this.root.parentElement?.focus();
  }

  /** Call after the content was re-rendered. */
  refresh() { if (this.isOpen) this.run(); }

  step(dir: number) {
    if (!this.isOpen) { this.open(); return; }
    if (!this.matches.length) return;
    this.current = (this.current + dir + this.matches.length) % this.matches.length;
    this.paint();
  }

  private clear() {
    this.matches = [];
    this.current = -1;
    registry()?.delete("search");
    registry()?.delete("search-current");
    this.count.textContent = "";
  }

  private run() {
    this.clear();
    const q = this.input.value.toLowerCase();
    if (!q) return;
    if (!registry() || typeof Highlight === "undefined") {
      // Fallback for engines without the Highlight API.
      (window as unknown as { find?: (s: string) => boolean }).find?.(this.input.value);
      return;
    }
    for (const line of this.root.querySelectorAll<HTMLElement>(".lc")) {
      const nodes: Text[] = [];
      const walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) nodes.push(walker.currentNode as Text);
      const text = nodes.map((n) => n.data).join("").toLowerCase();
      let idx = text.indexOf(q);
      while (idx >= 0) {
        this.matches.push(rangeFor(nodes, idx, idx + q.length));
        if (this.matches.length >= 10000) break;
        idx = text.indexOf(q, idx + q.length);
      }
    }
    this.current = this.matches.length ? 0 : -1;
    this.paint();
  }

  private paint() {
    const reg = registry();
    if (!reg || typeof Highlight === "undefined") return;
    reg.set("search", new Highlight(...this.matches));
    if (this.current >= 0) {
      const r = this.matches[this.current];
      reg.set("search-current", new Highlight(r));
      (r.startContainer.parentElement as HTMLElement | null)?.scrollIntoView({ block: "center", inline: "nearest" });
    }
    this.count.textContent = this.matches.length ? `${this.current + 1} of ${this.matches.length}` : "No matches";
  }
}

function rangeFor(nodes: Text[], start: number, end: number): Range {
  const range = document.createRange();
  let pos = 0;
  let startSet = false;
  for (const n of nodes) {
    const len = n.data.length;
    if (!startSet && start < pos + len) { range.setStart(n, start - pos); startSet = true; }
    if (startSet && end <= pos + len) { range.setEnd(n, end - pos); break; }
    pos += len;
  }
  return range;
}
