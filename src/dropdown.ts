// A drop-down menu under a toolbar button (History, Convert, language, tabs,
// "…", View, Copy).
import { icon, type IconName } from "./icons";

export interface DropdownItem {
  label: string;
  /** Muted second line. */
  meta?: string;
  title?: string;
  disabled?: boolean;
  /** Show the label in the code font (previews). */
  mono?: boolean;
  /** Colour of a language dot before the label. */
  dot?: string;
  /** Icon before the label. */
  icon?: IconName;
  /** The current item (highlighted, with a ✓). */
  selected?: boolean;
  /** A checkable item: true shows a ✓, false leaves the space empty. */
  checked?: boolean;
  /** Shortcut shown as a key chip. */
  key?: string;
  /** Keep the menu open after running (checkable items). */
  keepOpen?: boolean;
  run: () => void;
}

export interface DropdownOptions {
  /** Shown when there are no items. */
  emptyText?: string;
  /** Muted heading at the top of the menu. */
  heading?: string;
  /** Placeholder of a filter field at the top (type to filter). */
  search?: string;
  /** Element to open under (default: the menu's button). */
  anchor?: HTMLElement;
}

export class Dropdown {
  private typed = "";
  private typedTimer: number | undefined;
  private items: DropdownItem[] = [];
  private options: DropdownOptions = {};

  constructor(
    private readonly menu: HTMLElement,
    private readonly button: HTMLElement,
  ) {
    menu.addEventListener("keydown", (e) => this.onKey(e));
    document.addEventListener("mousedown", (e) => {
      const anchor = this.options.anchor ?? button;
      if (this.isOpen && !menu.contains(e.target as Node) && !button.contains(e.target as Node) && !anchor.contains(e.target as Node)) this.close(false);
    });
    window.addEventListener("resize", () => this.close(false));
  }

  get isOpen(): boolean {
    return !this.menu.hidden;
  }

  toggle(items: DropdownItem[], opts: DropdownOptions | string = {}) {
    if (this.isOpen) this.close();
    else this.open(items, opts);
  }

  open(items: DropdownItem[], opts: DropdownOptions | string = {}) {
    this.options = typeof opts === "string" ? { emptyText: opts } : opts;
    this.items = items;
    this.menu.replaceChildren();
    if (this.options.heading) {
      const h = document.createElement("div");
      h.className = "dropdown-heading";
      h.textContent = this.options.heading;
      this.menu.append(h);
    }
    let search: HTMLInputElement | null = null;
    if (this.options.search) {
      const wrap = document.createElement("label");
      wrap.className = "dropdown-search";
      wrap.innerHTML = icon("search", 14);
      search = document.createElement("input");
      search.type = "search";
      search.placeholder = this.options.search;
      search.spellcheck = false;
      search.addEventListener("input", () => this.filter(search!.value));
      search.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          this.buttons()[0]?.click();
        }
      });
      wrap.append(search);
      this.menu.append(wrap);
    }
    const list = document.createElement("div");
    list.className = "dropdown-list";
    this.menu.append(list);
    this.renderItems(list, items);
    this.position();
    this.menu.hidden = false;
    this.menu.classList.remove("opening");
    void this.menu.offsetWidth;
    this.menu.classList.add("opening");
    if (search) search.focus();
    else {
      const first = this.buttons().find((b) => b.classList.contains("selected")) ?? this.buttons()[0];
      if (first) first.focus();
      else this.menu.focus();
    }
  }

  close(focusButton = true) {
    if (!this.isOpen) return;
    this.menu.hidden = true;
    if (focusButton) (this.options.anchor ?? this.button).focus();
  }

  private position() {
    const anchor = this.options.anchor ?? this.button;
    const rect = anchor.getBoundingClientRect();
    this.menu.style.top = `${rect.bottom + 6}px`;
    const right = document.documentElement.clientWidth - rect.right;
    // Open towards the side with more room.
    if (rect.left < right) {
      this.menu.style.left = `${Math.max(8, rect.left)}px`;
      this.menu.style.right = "";
    } else {
      this.menu.style.right = `${Math.max(8, right)}px`;
      this.menu.style.left = "";
    }
    this.menu.style.maxHeight = `${Math.max(160, window.innerHeight - rect.bottom - 18)}px`;
  }

  private renderItems(list: HTMLElement, items: DropdownItem[]) {
    list.replaceChildren();
    if (!items.length) {
      const p = document.createElement("p");
      p.className = "dropdown-empty";
      p.textContent = this.options.emptyText ?? "";
      list.append(p);
    }
    for (const item of items) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "dropdown-item";
      if (item.meta) b.classList.add("two-line");
      if (item.selected) b.classList.add("selected");
      b.disabled = !!item.disabled;
      if (item.dot) {
        const dot = document.createElement("span");
        dot.className = "dot";
        dot.style.background = item.dot;
        b.append(dot);
      } else if (item.icon) {
        b.insertAdjacentHTML("beforeend", icon(item.icon, 14));
      }
      const text = document.createElement("span");
      text.className = "dropdown-text";
      const label = document.createElement("span");
      label.className = item.mono ? "dropdown-label mono" : "dropdown-label";
      label.textContent = item.label;
      text.append(label);
      if (item.meta) {
        const meta = document.createElement("span");
        meta.className = "dropdown-meta";
        meta.textContent = item.meta;
        text.append(meta);
      }
      b.append(text);
      if (item.key) {
        const k = document.createElement("span");
        k.className = "key-chip";
        k.textContent = item.key;
        b.append(k);
      }
      if (item.selected || item.checked !== undefined) {
        const check = document.createElement("span");
        check.className = "dropdown-check";
        if (item.selected || item.checked) check.innerHTML = icon("check", 14);
        b.append(check);
      }
      if (item.title) b.title = item.title;
      b.addEventListener("click", () => {
        if (item.keepOpen) {
          item.run();
          return;
        }
        this.close();
        item.run();
      });
      list.append(b);
    }
  }

  private filter(query: string) {
    const q = query.trim().toLowerCase();
    const list = this.menu.querySelector<HTMLElement>(".dropdown-list")!;
    this.renderItems(list, q ? this.items.filter((i) => i.label.toLowerCase().includes(q)) : this.items);
  }

  private buttons(): HTMLButtonElement[] {
    return [...this.menu.querySelectorAll<HTMLButtonElement>(".dropdown-item:not(:disabled)")];
  }

  private onKey(e: KeyboardEvent) {
    const items = this.buttons();
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    const inSearch = (e.target as HTMLElement).tagName === "INPUT";
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      this.close();
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      e.stopPropagation();
      const next = e.key === "ArrowDown" ? Math.min(items.length - 1, i + 1) : Math.max(0, i - 1);
      if (e.key === "ArrowUp" && i <= 0 && this.options.search) {
        this.menu.querySelector<HTMLInputElement>(".dropdown-search input")?.focus();
        return;
      }
      items[next]?.focus();
    } else if ((e.key === "Home" || e.key === "End") && !inSearch) {
      e.preventDefault();
      items[e.key === "Home" ? 0 : items.length - 1]?.focus();
    } else if (!inSearch && e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
      // Type to jump to an item.
      e.preventDefault();
      e.stopPropagation();
      const search = this.menu.querySelector<HTMLInputElement>(".dropdown-search input");
      if (search) {
        search.focus();
        search.value += e.key;
        this.filter(search.value);
        return;
      }
      clearTimeout(this.typedTimer);
      this.typed += e.key.toLowerCase();
      this.typedTimer = window.setTimeout(() => (this.typed = ""), 700);
      const match = items.find((b) => b.querySelector(".dropdown-label")?.textContent?.toLowerCase().startsWith(this.typed));
      match?.focus();
    }
  }
}
