// Turns parsed JSON into tree nodes for the side panel.
import { parseEmbeddedJson } from "./escapedJson";
import { shorten, type TreeNode } from "./tree";

/** Appends a property name or array index to a JSONPath-style path ($.a.b[0]["c d"]). */
export function jsonPath(parent: string, key: string | number): string {
  if (typeof key === "number") return `${parent}[${key}]`;
  return /^[A-Za-z_$][\w$]*$/.test(key) ? `${parent}.${key}` : `${parent}[${JSON.stringify(key)}]`;
}

export function jsonToTree(value: unknown, indent = 2): TreeNode[] {
  return [jsonNode("$", "$", value, indent, "tree-root")];
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function jsonNode(key: string, path: string, v: unknown, indent: number, keyClass: string): TreeNode {
  const searchKey = key.toLowerCase();
  if (Array.isArray(v)) {
    return {
      key, keyClass, path,
      summary: `[${plural(v.length, "item")}]`,
      childCount: v.length,
      children: () => v.map((x, i) => jsonNode(String(i), jsonPath(path, i), x, indent, "tree-index")),
      copyValue: () => JSON.stringify(v, null, indent),
      searchText: searchKey,
    };
  }
  if (v !== null && typeof v === "object") {
    const entries = Object.entries(v as Record<string, unknown>);
    return {
      key, keyClass, path,
      summary: `{${plural(entries.length, "key")}}`,
      childCount: entries.length,
      children: () => entries.map(([k, x]) => jsonNode(k, jsonPath(path, k), x, indent, "tree-prop")),
      copyValue: () => JSON.stringify(v, null, indent),
      searchText: searchKey,
    };
  }
  if (typeof v === "string") {
    const inner = parseEmbeddedJson(v);
    if (inner) return embeddedNode(key, path, v, inner, indent, keyClass);
  }
  const type = v === null ? "null" : typeof v;
  const raw = typeof v === "string" ? v : String(v);
  return {
    key, keyClass, path,
    value: shorten(typeof v === "string" ? JSON.stringify(v) : raw),
    valueClass: `tree-${type}`,
    childCount: 0,
    copyValue: () => raw,
    searchText: `${searchKey}\n${raw.toLowerCase()}`,
  };
}

/**
 * A string whose content is a JSON object or array: expandable like the inner
 * value (children's paths continue from the string's path), but "Copy value"
 * still copies the raw string.
 */
function embeddedNode(key: string, path: string, raw: string, inner: object, indent: number, keyClass: string): TreeNode {
  const node = jsonNode(key, path, inner, indent, keyClass);
  return {
    ...node,
    summary: `JSON string ${node.summary}`,
    embedded: true,
    copyValue: () => raw,
    searchText: `${node.searchText}\n${raw.toLowerCase()}`,
  };
}
