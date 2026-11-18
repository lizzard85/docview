// Side-by-side compare view: two panes with aligned rows, synchronized
// scrolling and navigation between changes.
import { stepChange, type DiffResult, type DiffRow, type Side } from "./compare";
import { gutterChars } from "./fontScale";
import { escapeHtml } from "./render";

export class CompareView {
  onClose: () => void = () => {};
  /** Called when "Raw text" or "Ignore whitespace" changes. */
  onOptionsChange: () => void = () => {};

  private readonly el = byId("compare");
  private readonly left = byId("compare-left");
  private readonly right = byId("compare-right");
  private readonly leftLabel = byId("compare-left-label");
  private readonly rightLabel = byId("compare-right-label");
  private readonly count = byId("compare-count");
  private readonly raw = byId<HTMLInputElement>("compare-raw");
  private readonly ws = byId<HTMLInputElement>("compare-ws");
  private result: DiffResult | null = null;
  /** Row index of the current change (-1 = none yet). */
  private current = -1;
  private syncing = false;

  constructor() {
    byId("compare-close").addEventListener("click", () => this.onClose());
    byId("compare-next").addEventListener("click", () => this.step(1));
    byId("compare-prev").addEventListener("click", () => this.step(-1));
    this.raw.addEventListener("change", () => this.onOptionsChange());
    this.ws.addEventListener("change", () => this.onOptionsChange());
    // Synchronized scrolling (rows are aligned, so the same scrollTop shows the same rows).
    const sync = (from: HTMLElement, to: HTMLElement) => () => {
      if (this.syncing) { this.syncing = false; return; }
      if (to.scrollTop !== from.scrollTop) { this.syncing = true; to.scrollTop = from.scrollTop; }
    };
    this.left.addEventListener("scroll", sync(this.left, this.right));
    this.right.addEventListener("scroll", sync(this.right, this.left));
  }

  get isOpen(): boolean {
    return !this.el.hidden;
  }

  get rawMode(): boolean {
    return this.raw.checked;
  }

  get ignoreWhitespace(): boolean {
    return this.ws.checked;
  }

  open(leftLabel: string, rightLabel: string) {
    this.leftLabel.textContent = leftLabel;
    this.rightLabel.textContent = rightLabel;
    this.el.hidden = false;
    document.body.classList.add("comparing");
  }

  close() {
    this.el.hidden = true;
    document.body.classList.remove("comparing");
    this.left.replaceChildren();
    this.right.replaceChildren();
    this.result = null;
  }

  showMessage(text: string) {
    this.count.textContent = text;
  }

  show(result: DiffResult) {
    this.result = result;
    this.current = -1;
    this.left.innerHTML = renderPane(result.rows, "left");
    this.right.innerHTML = renderPane(result.rows, "right");
    let last = 1;
    for (const row of result.rows) last = Math.max(last, row.left?.line ?? 0, row.right?.line ?? 0);
    for (const pane of [this.left, this.right]) pane.style.setProperty("--gutter", String(gutterChars(last) - 1));
    this.left.scrollTop = this.right.scrollTop = 0;
    this.updateCount();
  }

  /** Moves to the next (1) or previous (-1) change. */
  step(dir: 1 | -1) {
    const r = this.result;
    if (!r) return;
    const next = stepChange(r.changes, this.current, dir);
    if (next === undefined) return;
    this.current = next;
    for (const pane of [this.left, this.right]) {
      pane.querySelectorAll(".cmp-current").forEach((e) => e.classList.remove("cmp-current"));
      for (let i = next; i < r.rows.length && r.rows[i].kind !== "same"; i++) {
        pane.children[i]?.classList.add("cmp-current");
      }
    }
    const row = this.left.children[next] as HTMLElement | undefined;
    if (row) this.left.scrollTop = row.offsetTop - this.left.clientHeight / 3;
    this.updateCount();
  }

  private updateCount() {
    const n = this.result?.changes.length ?? 0;
    if (n === 0) { this.count.textContent = "No differences"; return; }
    const i = this.result!.changes.indexOf(this.current);
    const total = `${n} change${n === 1 ? "" : "s"}`;
    this.count.textContent = i >= 0 ? `Change ${i + 1} of ${n}` : total;
  }
}

function renderSide(side: Side | undefined, kind: DiffRow["kind"]): string {
  if (!side) return `<div class="cmp-line cmp-filler cmp-${kind}"><span class="ln"></span><span class="cmp-mark"></span><span class="lc"> </span></div>`;
  let html = "";
  for (const s of side.segments) html += s.changed && kind === "changed" ? `<mark>${escapeHtml(s.text)}</mark>` : escapeHtml(s.text);
  const mark = kind === "removed" ? "−" : kind === "added" ? "+" : "";
  return `<div class="cmp-line cmp-${kind}"><span class="ln">${side.line}</span><span class="cmp-mark">${mark}</span><span class="lc">${html || " "}</span></div>`;
}

function renderPane(rows: DiffRow[], which: "left" | "right"): string {
  let out = "";
  for (const row of rows) out += renderSide(row[which], row.kind);
  return out;
}

function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}
