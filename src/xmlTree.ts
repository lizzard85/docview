// Turns XML into tree nodes for the side panel.
import { XMLParser, XMLValidator } from "fast-xml-parser";
import { shorten, type TreeNode } from "./tree";

/** One item in fast-xml-parser's `preserveOrder` output: { tag: children, ":@": attributes }. */
type XmlItem = Record<string, unknown>;

const PARSER_OPTIONS = {
  preserveOrder: true,
  ignoreAttributes: false,
  attributeNamePrefix: "",
  commentPropName: "#comment",
  cdataPropName: "#cdata",
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
  ignoreDeclaration: true,
  ignorePiTags: true,
  allowBooleanAttributes: true,
} as const;

/** Parses XML (fragments with several root elements are allowed). Throws with a readable message. */
export function xmlToTree(text: string, indent = 2): TreeNode[] {
  const body = text.replace(/^﻿/, "");
  const valid = XMLValidator.validate(body, { allowBooleanAttributes: true });
  if (valid !== true) {
    // A fragment with several roots is fine; anything else is a real error.
    const wrapped = XMLValidator.validate(`<__r>${stripProlog(body)}</__r>`, { allowBooleanAttributes: true });
    if (wrapped !== true) throw new Error(`${valid.err.msg} (line ${valid.err.line}, column ${valid.err.col})`);
  }
  const items = new XMLParser(PARSER_OPTIONS).parse(body) as XmlItem[];
  return childNodes(items, "", indent);
}

function stripProlog(t: string): string {
  return t.replace(/^\s*<\?xml[^>]*\?>/, "").replace(/<!DOCTYPE[^>[]*(\[[\s\S]*?\])?\s*>/i, "");
}

// ------------------------------------------------------------------ item helpers

function tagOf(item: XmlItem): string {
  return Object.keys(item).find((k) => k !== ":@")!;
}

function attrsOf(item: XmlItem): [string, string][] {
  return Object.entries((item[":@"] as Record<string, unknown> | undefined) ?? {}).map(([k, v]) => [k, String(v)]);
}

function contentOf(item: XmlItem): XmlItem[] {
  const v = item[tagOf(item)];
  return Array.isArray(v) ? (v as XmlItem[]) : [];
}

/** Text of #text / #comment / #cdata items. */
function textOf(item: XmlItem): string {
  const tag = tagOf(item);
  const v = item[tag];
  if (tag === "#text") return String(v);
  return (v as XmlItem[]).map((x) => String(x["#text"] ?? "")).join("");
}

function isElement(tag: string): boolean {
  return !tag.startsWith("#");
}

// ------------------------------------------------------------------ tree nodes

function childNodes(items: XmlItem[], parentPath: string, indent: number): TreeNode[] {
  // XPath position predicates are only needed when a name repeats among siblings.
  const total = new Map<string, number>();
  for (const it of items) total.set(tagOf(it), (total.get(tagOf(it)) ?? 0) + 1);
  const seen = new Map<string, number>();
  return items.map((it) => {
    const tag = tagOf(it);
    const n = (seen.get(tag) ?? 0) + 1;
    seen.set(tag, n);
    const step = isElement(tag) ? tag : tag === "#text" ? "text()" : tag === "#comment" ? "comment()" : "text()";
    const path = `${parentPath}/${step}${total.get(tag)! > 1 ? `[${n}]` : ""}`;
    return itemNode(it, path, indent);
  });
}

function itemNode(item: XmlItem, path: string, indent: number): TreeNode {
  const tag = tagOf(item);
  if (!isElement(tag)) {
    const text = textOf(item);
    const label = tag === "#comment" ? "#comment" : tag === "#cdata" ? "#cdata" : "#text";
    return {
      key: label, keyClass: "tree-index", path,
      value: shorten(text), valueClass: tag === "#comment" ? "tree-comment" : "tree-string",
      childCount: 0,
      copyValue: () => text,
      searchText: text.toLowerCase(),
    };
  }

  const attrs = attrsOf(item);
  const content = contentOf(item);
  const attrText = attrs.map(([k, v]) => `${k}="${v}"`).join(" ");
  const searchText = `${tag}\n${attrText}`.toLowerCase();

  // <name>text</name> without attributes is shown as a leaf: name: text
  if (!attrs.length && content.length === 1 && tagOf(content[0]) === "#text") {
    const text = textOf(content[0]);
    return {
      key: tag, keyClass: "tree-tag", path,
      value: shorten(text), valueClass: "tree-string",
      childCount: 0,
      copyValue: () => text,
      searchText: `${searchText}\n${text.toLowerCase()}`,
    };
  }

  const attrNodes = (): TreeNode[] =>
    attrs.map(([k, v]) => ({
      key: `@${k}`, keyClass: "tree-attr", path: `${path}/@${k}`,
      value: shorten(JSON.stringify(v)), valueClass: "tree-string",
      childCount: 0,
      copyValue: () => v,
      searchText: `${k}\n${v}`.toLowerCase(),
    }));

  return {
    key: tag, keyClass: "tree-tag", path,
    summary: shorten(attrText) || (content.length ? "" : "(empty)"),
    childCount: attrs.length + content.length,
    children: () => [...attrNodes(), ...childNodes(content, path, indent)],
    copyValue: () => serialize(item, " ".repeat(indent), ""),
    searchText,
  };
}

// ------------------------------------------------------------------ serializer

const escText = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escAttr = (s: string) => escText(s).replace(/"/g, "&quot;");

/** Serializes an item as indented XML (used by "Copy value"). */
export function serialize(item: XmlItem, unit: string, pad: string): string {
  const tag = tagOf(item);
  if (tag === "#text") return pad + escText(textOf(item));
  if (tag === "#comment") return `${pad}<!--${textOf(item)}-->`;
  if (tag === "#cdata") return `${pad}<![CDATA[${textOf(item)}]]>`;
  const attrs = attrsOf(item).map(([k, v]) => ` ${k}="${escAttr(v)}"`).join("");
  const content = contentOf(item);
  if (!content.length) return `${pad}<${tag}${attrs}/>`;
  if (content.length === 1 && tagOf(content[0]) === "#text") {
    return `${pad}<${tag}${attrs}>${escText(textOf(content[0]))}</${tag}>`;
  }
  const inner = content.map((c) => serialize(c, unit, pad + unit)).join("\n");
  return `${pad}<${tag}${attrs}>\n${inner}\n${pad}</${tag}>`;
}
