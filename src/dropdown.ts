// A drop-down menu under a toolbar button (History, Convert).

export interface DropdownItem {
  label: string;
  /** Muted second line. */
  meta?: string;
  title?: string;
  disabled?: boolean;
  /** Show the label in the code font (previews). */
  mono?: boolean;
  run: () => void;
}

export class Dropdown {
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

  toggle(items: DropdownItem[], emptyText = "") {
    if (this.isOpen) this.close();
    else this.open(items, emptyText);
  }

  open(items: DropdownItem[], emptyText = "") {
    this.menu.replaceChildren();
    if (!items.length) {
      const p = document.createElement("p");
      p.className = "dropdown-empty muted";
      p.textContent = emptyText;
      this.menu.append(p);
    }
    for (const item of items) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "dropdown-item";
      b.disabled = !!item.disabled;
      const label = document.createElement("span");
      label.className = item.mono ? "dropdown-label mono" : "dropdown-label";
      label.textContent = item.label;
      b.append(label);
      if (item.meta) {
        const meta = document.createElement("span");
        meta.className = "dropdown-meta muted";
        meta.textContent = item.meta;
        b.append(meta);
      }
      if (item.title) b.title = item.title;
      b.addEventListener("click", () => {
        this.close();
        item.run();
      });
      this.menu.append(b);
    }
    const rect = this.button.getBoundingClientRect();
    this.menu.style.top = `${rect.bottom + 4}px`;
    const right = document.documentElement.clientWidth - rect.right;
    // Open towards the side with more room.
    if (rect.left < right) {
      this.menu.style.left = `${Math.max(8, rect.left)}px`;
      this.menu.style.right = "";
    } else {
      this.menu.style.right = `${Math.max(8, right)}px`;
      this.menu.style.left = "";
    }
    this.menu.hidden = false;
    const first = this.items()[0];
    if (first) first.focus();
    else this.menu.focus();
  }

  close() {
    if (!this.isOpen) return;
    this.menu.hidden = true;
    this.button.focus();
  }

  private items(): HTMLButtonElement[] {
    return [...this.menu.querySelectorAll<HTMLButtonElement>(".dropdown-item:not(:disabled)")];
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
