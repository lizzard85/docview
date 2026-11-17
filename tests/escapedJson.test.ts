import { describe, expect, it } from "vitest";
import { parseEmbeddedJson, unwrapEscapedJson } from "../src/escapedJson";
import { jsonToTree } from "../src/jsonTree";
import { filterTree, type TreeNode } from "../src/tree";

function child(node: TreeNode, key: string): TreeNode {
  const c = node.children?.().find((n) => n.key === key);
  if (!c) throw new Error(`no child ${key}`);
  return c;
}

describe("unwrapEscapedJson", () => {
  it("unwraps a JSON string literal holding JSON", () => {
    expect(unwrapEscapedJson('"{\\"id\\":1,\\"name\\":\\"x\\"}"')).toEqual({ text: '{"id":1,"name":"x"}', levels: 1 });
  });

  it("unwraps bare escaped JSON without surrounding quotes", () => {
    expect(unwrapEscapedJson('{\\"id\\":1}')).toEqual({ text: '{"id":1}', levels: 1 });
    expect(unwrapEscapedJson('  [{\\"a\\":\\"b\\"}]\n')).toEqual({ text: '[{"a":"b"}]', levels: 1 });
  });

  it("unwraps nested escaped strings", () => {
    const inner = { id: 1, msg: 'say "hi"' };
    let s = JSON.stringify(inner);
    for (let i = 0; i < 3; i++) s = JSON.stringify(s);
    expect(unwrapEscapedJson(s)).toEqual({ text: JSON.stringify(inner), levels: 3 });
    // The same as bare escaped text, without the surrounding quotes.
    const bare = JSON.stringify(JSON.stringify(inner)).slice(1, -1);
    expect(unwrapEscapedJson(bare)).toEqual({ text: JSON.stringify(inner), levels: 1 });
  });

  it("stops after the maximum number of levels", () => {
    let s = "{}";
    for (let i = 0; i < 6; i++) s = JSON.stringify(s);
    expect(unwrapEscapedJson(s)).toBeNull();
  });

  it("leaves normal JSON and other text alone", () => {
    expect(unwrapEscapedJson('{"id":1}')).toBeNull();
    expect(unwrapEscapedJson('["a\\"b"]')).toBeNull();
    expect(unwrapEscapedJson('"just a string"')).toBeNull();
    expect(unwrapEscapedJson('"{ not json }"')).toBeNull();
    expect(unwrapEscapedJson('"42"')).toBeNull();
    expect(unwrapEscapedJson("SELECT 1")).toBeNull();
    expect(unwrapEscapedJson("")).toBeNull();
  });
});

describe("parseEmbeddedJson", () => {
  it("accepts only objects and arrays", () => {
    expect(parseEmbeddedJson(' {"a":1} ')).toEqual({ a: 1 });
    expect(parseEmbeddedJson("[1,2]")).toEqual([1, 2]);
    expect(parseEmbeddedJson("42")).toBeUndefined();
    expect(parseEmbeddedJson('"x"')).toBeUndefined();
    expect(parseEmbeddedJson("{name}")).toBeUndefined();
    expect(parseEmbeddedJson("[INFO] started")).toBeUndefined();
  });
});

describe("embedded JSON in the tree", () => {
  const data = {
    payload: JSON.stringify({ id: 7, tags: ["a", "b"] }),
    list: "[1, 2, 3]",
    broken: "{not json",
    text: "[INFO] hello",
  };
  const [root] = jsonToTree(data);

  it("makes a string holding JSON expandable with a marker", () => {
    const payload = child(root, "payload");
    expect(payload.embedded).toBe(true);
    expect(payload.summary).toBe("JSON string {2 keys}");
    expect(payload.value).toBeUndefined();
    expect(payload.childCount).toBe(2);
    expect(child(root, "list").summary).toBe("JSON string [3 items]");
  });

  it("continues paths from the string's path", () => {
    const payload = child(root, "payload");
    expect(child(payload, "id").path).toBe("$.payload.id");
    expect(child(child(payload, "tags"), "1").path).toBe("$.payload.tags[1]");
    expect(child(payload, "id").copyValue()).toBe("7");
  });

  it("still copies the raw string", () => {
    expect(child(root, "payload").copyValue()).toBe(data.payload);
  });

  it("keeps invalid or non-JSON strings as strings", () => {
    for (const key of ["broken", "text"]) {
      const n = child(root, key);
      expect(n.childCount).toBe(0);
      expect(n.embedded).toBeUndefined();
      expect(n.valueClass).toBe("tree-string");
    }
  });

  it("is searched by the filter", () => {
    const r = filterTree(jsonToTree(data), "tags");
    const payload = child(r.nodes[0], "payload");
    expect(payload.open).toBe(true);
    expect(child(payload, "tags").path).toBe("$.payload.tags");
  });
});
