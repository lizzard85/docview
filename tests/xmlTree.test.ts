import { describe, expect, it } from "vitest";
import type { TreeNode } from "../src/tree";
import { xmlToTree } from "../src/xmlTree";

const xml = `<?xml version="1.0" encoding="utf-8"?>
<!-- orders -->
<orders count="2">
  <order id="1"><customer>Alice</customer><total>10.5</total></order>
  <order id="2"><customer>Bob &amp; Co</customer><note><![CDATA[<urgent>]]></note><empty/></order>
</orders>`;

function child(node: TreeNode, key: string, nth = 0): TreeNode {
  const c = node.children?.().filter((n) => n.key === key)[nth];
  if (!c) throw new Error(`no child ${key}`);
  return c;
}

describe("xmlToTree", () => {
  const nodes = xmlToTree(xml);
  const orders = nodes.find((n) => n.key === "orders")!;

  it("keeps top-level comments and the root element", () => {
    expect(nodes.map((n) => n.key)).toEqual(["#comment", "orders"]);
    expect(orders.path).toBe("/orders");
    expect(orders.summary).toBe('count="2"');
  });

  it("lists attributes first, then child elements with XPath positions", () => {
    expect(orders.children!().map((n) => n.key)).toEqual(["@count", "order", "order"]);
    expect(child(orders, "@count").path).toBe("/orders/@count");
    expect(child(orders, "order", 1).path).toBe("/orders/order[2]");
  });

  it("shows text-only elements as leaves", () => {
    const customer = child(child(orders, "order", 1), "customer");
    expect(customer.childCount).toBe(0);
    expect(customer.value).toBe("Bob & Co");
    expect(customer.path).toBe("/orders/order[2]/customer");
  });

  it("handles CDATA and empty elements", () => {
    const order2 = child(orders, "order", 1);
    expect(child(child(order2, "note"), "#cdata").copyValue()).toBe("<urgent>");
    expect(child(order2, "empty").summary).toBe("(empty)");
  });

  it("copies an element as indented XML", () => {
    expect(child(orders, "order", 0).copyValue()).toBe(
      '<order id="1">\n  <customer>Alice</customer>\n  <total>10.5</total>\n</order>',
    );
  });

  it("accepts fragments with several roots", () => {
    expect(xmlToTree("<a>1</a><b>2</b>").map((n) => n.path)).toEqual(["/a", "/b"]);
  });

  it("reports parse errors with a position", () => {
    expect(() => xmlToTree("<a><b></a>")).toThrow(/line 1/);
  });
});
