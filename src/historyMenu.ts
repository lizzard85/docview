// Drop-down list of the history under the History button.
import { relativeTime, type HistoryEntry } from "./history";
import { LANG_BY_ID } from "./languages";

export class HistoryMenu {
  onPick: (entry: HistoryEntry) => void = () => {};

  constructor(
    private readonly menu: HTMLElement,
    private readonly button: HTMLElement,
  ) {
    menu.addEventListener("keydown", (e) => this.onKey(e));
    document.addEventListener("mousedown", (e) => {
      if (this.isOpen && !menu.contains(e.target as Node) && !button.contains(e.target as Node)) this.close();
    });
  }

  get isOpen(): boolean {
    return !this.menu.hidden;
  }

  toggle(entries: HistoryEntry[], enabled: boolean) {
    if (this.isOpen) this.close();
    else this.open(entries, enabled);
  }

  open(entries: HistoryEntry[], enabled: boolean) {
    this.menu.replaceChildren();
    if (!entries.length) {
      const p = document.createElement("p");
      p.className = "history-empty muted";
      p.textContent = enabled ? "No history yet." : "History is turned off (Settings).";
      this.menu.append(p);
    }
    const now = Date.now();
    for (const entry of entries) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "history-item";
      const preview = document.createElement("span");
      preview.className = "history-preview";
      preview.textContent = entry.preview || "(empty)";
      const meta = document.createElement("span");
      meta.className = "history-meta muted";
      const lang = LANG_BY_ID.get(entry.lang)?.label ?? entry.lang;
      meta.textContent = [lang, entry.name, relativeTime(entry.time, now)].filter(Boolean).join(" · ");
      b.append(preview, meta);
      b.title = new Date(entry.time).toLocaleString();
      b.addEventListener("click", () => {
        this.close();
        this.onPick(entry);
      });
      this.menu.append(b);
    }
    const rect = this.button.getBoundingClientRect();
    this.menu.style.top = `${rect.bottom + 4}px`;
    this.menu.style.right = `${Math.max(8, document.documentElement.clientWidth - rect.right)}px`;
    this.menu.hidden = false;
    this.items()[0]?.focus();
    if (!entries.length) this.menu.focus();
  }

  close() {
    if (!this.isOpen) return;
    this.menu.hidden = true;
    this.button.focus();
  }

  private items(): HTMLButtonElement[] {
    return [...this.menu.querySelectorAll<HTMLButtonElement>(".history-item")];
  }

  private onKey(e: KeyboardEvent) {
    const items = this.items();
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      this.close();
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      e.stopPropagation();
      const next = e.key === "ArrowDown" ? Math.min(items.length - 1, i + 1) : Math.max(0, i - 1);
      items[next]?.focus();
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      items[e.key === "Home" ? 0 : items.length - 1]?.focus();
    }
  }
}
