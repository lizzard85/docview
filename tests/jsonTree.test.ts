import { describe, expect, it } from "vitest";
import { jsonPath, jsonToTree } from "../src/jsonTree";
import { filterTree, type TreeNode } from "../src/tree";

const data = {
  name: "DocView",
  "with space": true,
  items: [{ id: 1, tags: ["a", "b"] }, { id: 2, note: null }],
};

function child(node: TreeNode, key: string): TreeNode {
  const c = node.children?.().find((n) => n.key === key);
  if (!c) throw new Error(`no child ${key}`);
  return c;
}

describe("jsonPath", () => {
  it("builds JSONPath-style paths", () => {
    expect(jsonPath("$", "items")).toBe("$.items");
    expect(jsonPath("$.items", 3)).toBe("$.items[3]");
    expect(jsonPath("$", "with space")).toBe('$["with space"]');
    expect(jsonPath("$", "1abc")).toBe('$["1abc"]');
  });
});

describe("jsonToTree", () => {
  const [root] = jsonToTree(data);

  it("describes objects and arrays", () => {
    expect(root.path).toBe("$");
    expect(root.summary).toBe("{3 keys}");
    expect(child(root, "items").summary).toBe("[2 items]");
    expect(child(child(root, "items"), "0").summary).toBe("{2 keys}");
  });

  it("gives leaves a typed value and a path", () => {
    const name = child(root, "name");
    expect(name.value).toBe('"DocView"');
    expect(name.valueClass).toBe("tree-string");
    expect(name.copyValue()).toBe("DocView");
    const tag = child(child(child(child(root, "items"), "0"), "tags"), "1");
    expect(tag.path).toBe("$.items[0].tags[1]");
    expect(child(child(child(root, "items"), "1"), "note").valueClass).toBe("tree-null");
  });

  it("copies objects as indented JSON", () => {
    expect(child(child(root, "items"), "1").copyValue()).toBe('{\n  "id": 2,\n  "note": null\n}');
  });
});

describe("filterTree", () => {
  it("keeps matches and opens their ancestors", () => {
    const r = filterTree(jsonToTree(data), "note");
    expect(r.incomplete).toBe(false);
    const root = r.nodes[0];
    expect(root.open).toBe(true);
    const items = child(root, "items");
    expect(items.childCount).toBe(1);
    expect(child(items, "1").childCount).toBe(1);
  });

  it("matches values too", () => {
    const r = filterTree(jsonToTree(data), "docview");
    expect(r.nodes[0].children!().map((n) => n.key)).toEqual(["name"]);
  });

  it("returns nothing when nothing matches", () => {
    expect(filterTree(jsonToTree(data), "zzz").nodes).toEqual([]);
  });

  it("stops after the node budget", () => {
    const big = Array.from({ length: 1000 }, (_, i) => ({ i }));
    expect(filterTree(jsonToTree(big), "x", 100).incomplete).toBe(true);
  });
});
