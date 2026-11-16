// Finds where tree nodes (by their JSONPath / XPath) are in the text shown in
// the code view, so selecting a node can scroll the code to that line.
import { jsonPath } from "./jsonTree";

/** Path -> character offset. Object members point at their key. */
export type Locations = Map<string, number>;

const SPACE = 32, TAB = 9, LF = 10, CR = 13, QUOTE = 34, BACKSLASH = 92, COMMA = 44;
const OPEN_BRACE = 123, CLOSE_BRACE = 125, OPEN_BRACKET = 91, CLOSE_BRACKET = 93, COLON = 58;

/** Scans JSON text and records the offset of every value, keyed by the same paths as the tree. */
export function jsonLocations(text: string): Locations {
  const map: Locations = new Map();
  let i = 0;
  const ws = () => {
    for (let c = text.charCodeAt(i); c === SPACE || c === LF || c === CR || c === TAB || c === 0xfeff; c = text.charCodeAt(++i));
  };
  const str = (): string => {
    const start = i++;
    while (i < text.length && text.charCodeAt(i) !== QUOTE) i += text.charCodeAt(i) === BACKSLASH ? 2 : 1;
    i++;
    return JSON.parse(text.slice(start, i)) as string;
  };
  const value = (path: string, at: number) => {
    ws();
    map.set(path, at >= 0 ? at : i);
    const c = text.charCodeAt(i);
    if (c === OPEN_BRACE) {
      i++; ws();
      if (text.charCodeAt(i) === CLOSE_BRACE) { i++; return; }
      for (;;) {
        ws();
        const keyAt = i;
        const key = str();
        ws();
        if (text.charCodeAt(i) === COLON) i++;
        value(jsonPath(path, key), keyAt);
        ws();
        if (text.charCodeAt(i++) !== COMMA) return;
      }
    }
    if (c === OPEN_BRACKET) {
      i++; ws();
      if (text.charCodeAt(i) === CLOSE_BRACKET) { i++; return; }
      for (let n = 0; ; n++) {
        value(jsonPath(path, n), -1);
        ws();
        if (text.charCodeAt(i++) !== COMMA) return;
      }
    }
    if (c === QUOTE) { str(); return; }
    // number, true, false, null
    for (let d = text.charCodeAt(i); i < text.length && d !== COMMA && d !== CLOSE_BRACE && d !== CLOSE_BRACKET && d !== SPACE && d !== LF && d !== CR && d !== TAB; d = text.charCodeAt(++i));
  };
  try {
    value("$", -1);
  } catch {
    // Malformed text: keep what was found so far.
  }
  return map;
}

interface XmlEl {
  name: string;
  offset: number;
  attrs: [string, number][];
  children: XmlEl[];
}

const XML_TOKEN =
  /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\?[\s\S]*?\?>|<!DOCTYPE[^>[]*(\[[\s\S]*?\])?\s*>|<\/([^\s>]+)\s*>|<([^\s/>!?]+)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>/gi;
const XML_ATTR = /([^\s=]+)(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"']+))?/g;

/** Scans XML text and records the offset of every element and attribute, keyed by the same XPaths as the tree. */
export function xmlLocations(text: string): Locations {
  const root: XmlEl = { name: "", offset: 0, attrs: [], children: [] };
  const stack = [root];
  XML_TOKEN.lastIndex = 0;
  for (let m: RegExpExecArray | null; (m = XML_TOKEN.exec(text)); ) {
    if (m[2]) {
      // End tag: close up to the matching start tag.
      for (let k = stack.length - 1; k > 0; k--) {
        if (stack[k].name === m[2]) { stack.length = k; break; }
      }
    } else if (m[3]) {
      const el: XmlEl = { name: m[3], offset: m.index, attrs: [], children: [] };
      const bodyStart = m.index + 1 + m[3].length;
      XML_ATTR.lastIndex = 0;
      for (let a: RegExpExecArray | null; (a = XML_ATTR.exec(m[4])); ) el.attrs.push([a[1], bodyStart + a.index]);
      stack[stack.length - 1].children.push(el);
      if (!m[5]) stack.push(el);
    }
  }

  const map: Locations = new Map();
  const walk = (el: XmlEl, path: string) => {
    // Same rule as the tree: a position only when the name repeats among siblings.
    const total = new Map<string, number>();
    for (const c of el.children) total.set(c.name, (total.get(c.name) ?? 0) + 1);
    const seen = new Map<string, number>();
    for (const c of el.children) {
      const n = (seen.get(c.name) ?? 0) + 1;
      seen.set(c.name, n);
      const p = `${path}/${c.name}${total.get(c.name)! > 1 ? `[${n}]` : ""}`;
      map.set(p, c.offset);
      for (const [k, off] of c.attrs) map.set(`${p}/@${k}`, off);
      walk(c, p);
    }
  };
  walk(root, "");
  return map;
}

const JSON_LAST_STEP = /(\.[A-Za-z_$][\w$]*|\[(?:\d+|"(?:[^"\\]|\\.)*")\])$/;

/** Offset for `path`; nodes without their own position (e.g. XML text) use their nearest ancestor. */
export function findOffset(map: Locations, path: string, lang: "json" | "xml"): number | undefined {
  let p = path;
  while (p) {
    const off = map.get(p);
    if (off !== undefined) return off;
    const parent = lang === "json" ? p.replace(JSON_LAST_STEP, "") : p.replace(/\/[^/]*$/, "");
    if (parent === p) return undefined;
    p = parent;
  }
  return undefined;
}

/** Start offset of every line. */
export function lineStarts(text: string): number[] {
  const starts = [0];
  for (let i = text.indexOf("\n"); i >= 0; i = text.indexOf("\n", i + 1)) starts.push(i + 1);
  return starts;
}

/** 0-based line number of `offset`. */
export function lineOf(starts: number[], offset: number): number {
  let lo = 0, hi = starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (starts[mid] <= offset) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}
