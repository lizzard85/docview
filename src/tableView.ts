// Table view of CSV/TSV for the side panel: sticky header, sortable columns,
// row filter and rows rendered in chunks ("Show more").
import { filterRows, sortRows, type CsvData, type SortDir } from "./csv";

/** Rows are rendered in chunks of this size. */
const CHUNK = 500;
/** Display length for long cells; copying still copies everything. */
const MAX_CELL_CHARS = 200;

export interface CellInfo {
  /** 1-based row number in the file (counting the header row). */
  row: number;
  /** Column name (header text, or "Column n"). */
  column: string;
  value: string;
  /** 0-based line in the text where the row starts. */
  line: number;
}

export class TableView {
  onSelect: (cell: CellInfo | null) => void = () => {};
  onCopy: (value: string) => void = () => {};
  /** Called with a status text ("12 rows", "3 of 12 rows"). */
  onStatus: (text: string) => void = () => {};

  private data: CsvData | null = null;
  private header = true;
  private query = "";
  private sort: { col: number; dir: SortDir } | null = null;
  private table: HTMLTableElement | null = null;
  private selected: HTMLTableCellElement | null = null;

  constructor(private readonly root: HTMLElement) {
    root.addEventListener("click", (e) => this.onClick(e));
    root.addEventListener("keydown", (e) => this.onKey(e));
  }

  /** Shows a new table (sorting is reset). */
  show(data: CsvData, header: boolean, query: string) {
    this.data = data;
    this.header = header;
    this.query = query;
    this.sort = null;
    this.render();
  }

  setHeader(on: boolean) {
    if (on === this.header) return;
    this.header = on;
    this.sort = null;
    this.render();
  }

  setFilter(query: string) {
    this.query = query;
    this.render();
  }

  /** True while a table is shown in the root element. */
  get active(): boolean {
    return !!this.table && this.root.contains(this.table);
  }

  private columnNames(): string[] {
    const rows = this.data!.rows;
    const count = Math.max(0, ...rows.map((r) => r.length));
    const head = this.header ? rows[0] ?? [] : [];
    return Array.from({ length: count }, (_, i) => head[i]?.trim() || `Column ${i + 1}`);
  }

  private bodyRows(): number[] {
    const rows = this.data!.rows;
    const first = this.header ? 1 : 0;
    const body = rows.slice(first);
    let order = this.sort ? sortRows(body, this.sort.col, this.sort.dir) : body.map((_, i) => i);
    order = filterRows(body, order, this.query);
    return order.map((i) => i + first);
  }

  private render() {
    const data = this.data;
    if (!data) return;
    const names = this.columnNames();
    const table = document.createElement("table");
    table.className = "csv-table";
    const thead = table.createTHead();
    const hr = thead.insertRow();
    const corner = document.createElement("th");
    corner.className = "csv-rownum";
    corner.textContent = "#";
    hr.append(corner);
    names.forEach((name, i) => {
      const th = document.createElement("th");
      th.dataset.col = String(i);
      th.title = "Sort";
      th.textContent = name;
      if (this.sort?.col === i) {
        th.classList.add("sorted");
        th.append(span(this.sort.dir === "asc" ? " ▲" : " ▼", "csv-sort"));
      }
      hr.append(th);
    });
    const tbody = table.createTBody();
    const order = this.bodyRows();
    this.appendRows(tbody, order, 0, names.length);

    this.table = table;
    this.selected = null;
    this.root.replaceChildren(table);
    this.onSelect(null);
    const total = data.rows.length - (this.header ? 1 : 0);
    const what = `${total} row${total === 1 ? "" : "s"}`;
    this.onStatus(order.length === total ? what : `${order.length} of ${what}`);
  }

  private appendRows(tbody: HTMLTableSectionElement, order: number[], start: number, cols: number) {
    const rows = this.data!.rows;
    const end = Math.min(order.length, start + CHUNK);
    const frag = document.createDocumentFragment();
    for (let k = start; k < end; k++) {
      const r = order[k];
      const tr = document.createElement("tr");
      tr.dataset.row = String(r);
      const num = document.createElement("td");
      num.className = "csv-rownum";
      num.textContent = String(r + 1);
      tr.append(num);
      for (let c = 0; c < cols; c++) {
        const td = document.createElement("td");
        const v = rows[r][c] ?? "";
        td.textContent = v.length > MAX_CELL_CHARS ? v.slice(0, MAX_CELL_CHARS) + "…" : v;
        if (v.length > MAX_CELL_CHARS || v.includes("\n")) td.title = v;
        tr.append(td);
      }
      frag.append(tr);
    }
    if (end < order.length) {
      const tr = document.createElement("tr");
      tr.className = "csv-more";
      const td = document.createElement("td");
      td.colSpan = cols + 1;
      td.textContent = `Show more (${order.length - end} remaining)`;
      td.addEventListener("click", (e) => {
        e.stopPropagation();
        tr.remove();
        this.appendRows(tbody, order, end, cols);
      });
      tr.append(td);
      frag.append(tr);
    }
    tbody.append(frag);
  }

  private onClick(e: MouseEvent) {
    if (!this.active) return;
    const cell = (e.target as HTMLElement).closest<HTMLTableCellElement>("th, td");
    if (!cell || cell.closest(".csv-more")) return;
    if (cell.tagName === "TH") {
      const col = cell.dataset.col;
      if (col === undefined) return;
      const c = Number(col);
      // asc -> desc -> unsorted
      this.sort = this.sort?.col !== c ? { col: c, dir: "asc" } : this.sort.dir === "asc" ? { col: c, dir: "desc" } : null;
      this.render();
      return;
    }
    this.select(cell.classList.contains("csv-rownum") ? (cell.nextElementSibling as HTMLTableCellElement | null) : cell);
  }

  private select(cell: HTMLTableCellElement | null) {
    this.selected?.classList.remove("selected");
    this.selected = cell;
    if (!cell) { this.onSelect(null); return; }
    cell.classList.add("selected");
    cell.scrollIntoView({ block: "nearest", inline: "nearest" });
    this.root.focus({ preventScroll: true });
    const r = Number(cell.parentElement!.dataset.row);
    const c = cell.cellIndex - 1;
    this.onSelect({
      row: r + 1,
      column: this.columnNames()[c],
      value: this.data!.rows[r][c] ?? "",
      line: this.data!.lines[r],
    });
  }

  private onKey(e: KeyboardEvent) {
    if (!this.active || !this.selected) return;
    const cell = this.selected;
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === "c" && !window.getSelection()?.toString()) {
      e.preventDefault();
      e.stopPropagation();
      const r = Number(cell.parentElement!.dataset.row);
      this.onCopy(this.data!.rows[r][cell.cellIndex - 1] ?? "");
      return;
    }
    const tr = cell.parentElement as HTMLTableRowElement;
    let next: Element | null | undefined = null;
    if (e.key === "ArrowLeft") next = cell.cellIndex > 1 ? cell.previousElementSibling : null;
    else if (e.key === "ArrowRight") next = cell.nextElementSibling;
    else if (e.key === "ArrowUp") next = tr.previousElementSibling?.children[cell.cellIndex];
    else if (e.key === "ArrowDown") {
      const below = tr.nextElementSibling;
      next = below && !below.classList.contains("csv-more") ? below.children[cell.cellIndex] : null;
    } else return;
    e.preventDefault();
    if (next) this.select(next as HTMLTableCellElement);
  }
}

function span(text: string, className: string): HTMLSpanElement {
  const s = document.createElement("span");
  s.className = className;
  s.textContent = text;
  return s;
}
