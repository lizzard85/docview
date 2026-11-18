// Tooltips for the app chrome: an inverse pill shown after 500ms, 8px from
// its target, with the current shortcut in a key chip. The native `title` is
// moved aside while hovering so the system tooltip does not show as well.

const DELAY = 500;
const OFFSET = 8;

export interface TooltipText {
  label: string;
  key?: string;
}

export class Tooltips {
  private timer: number | undefined;
  private target: HTMLElement | null = null;

  /**
   * `scope` selects the elements that get the styled tooltip; `text` returns
   * the label and shortcut for an element (by default its title).
   */
  constructor(
    private readonly tip: HTMLElement,
    private readonly scope: string,
    private readonly text: (el: HTMLElement, title: string) => TooltipText,
  ) {
    document.addEventListener("mouseover", (e) => this.onOver(e));
    document.addEventListener("mousedown", () => this.hide());
    document.addEventListener("keydown", () => this.hide(), true);
    window.addEventListener("blur", () => this.hide());
  }

  private onOver(e: MouseEvent) {
    const el = (e.target as HTMLElement | null)?.closest<HTMLElement>(this.scope);
    if (el === this.target) return;
    this.hide();
    if (!el) return;
    const title = el.getAttribute("title") ?? el.dataset.tipTitle ?? "";
    if (!title) return;
    this.target = el;
    // Park the title so the native tooltip does not appear.
    el.dataset.tipTitle = title;
    el.removeAttribute("title");
    el.addEventListener("mouseleave", this.onLeave, { once: true });
    this.timer = window.setTimeout(() => this.show(el, title), DELAY);
  }

  private readonly onLeave = () => this.hide();

  private show(el: HTMLElement, title: string) {
    if (!el.isConnected) return;
    const { label, key } = this.text(el, title);
    this.tip.replaceChildren(document.createTextNode(label));
    this.tip.classList.toggle("has-key", !!key);
    if (key) {
      const chip = document.createElement("span");
      chip.className = "key-chip";
      chip.textContent = key;
      this.tip.append(chip);
    }
    this.tip.hidden = false;
    const r = el.getBoundingClientRect();
    const t = this.tip.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    let top = r.bottom + OFFSET;
    if (top + t.height > window.innerHeight - 4) top = r.top - OFFSET - t.height;
    const left = Math.min(vw - t.width - 8, Math.max(8, r.left + r.width / 2 - t.width / 2));
    this.tip.style.top = `${top}px`;
    this.tip.style.left = `${left}px`;
  }

  hide() {
    clearTimeout(this.timer);
    this.tip.hidden = true;
    const el = this.target;
    this.target = null;
    if (el?.dataset.tipTitle !== undefined) {
      // A title set while hovering (e.g. a shortcut change) wins.
      if (!el.hasAttribute("title")) el.setAttribute("title", el.dataset.tipTitle);
      delete el.dataset.tipTitle;
    }
  }
}
