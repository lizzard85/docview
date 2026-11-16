import { describe, expect, it } from "vitest";
import { activate, activeTab, addTab, closeTab, createTabs, cycle, tabTitle, updateTab } from "../src/tabs";

const ids = (t: { tabs: { id: number }[] }) => t.tabs.map((x) => x.id);

describe("tabs", () => {
  it("adds tabs after the active one and activates them", () => {
    let t = createTabs("a");
    t = addTab(t, "b");
    t = addTab(t, "c");
    expect(ids(t)).toEqual([1, 2, 3]);
    t = activate(t, 1);
    t = addTab(t, "d");
    expect(ids(t)).toEqual([1, 4, 2, 3]);
    expect(activeTab(t).data).toBe("d");
  });

  it("closes the active tab and activates the right neighbour, or the left at the end", () => {
    let t = addTab(addTab(createTabs("a"), "b"), "c"); // active 3
    t = activate(t, 2);
    t = closeTab(t, 2, "");
    expect(ids(t)).toEqual([1, 3]);
    expect(t.active).toBe(3);
    t = closeTab(t, 3, "");
    expect(t.active).toBe(1);
  });

  it("keeps the active tab when closing another one", () => {
    let t = addTab(createTabs("a"), "b"); // active 2
    t = closeTab(t, 1, "");
    expect(ids(t)).toEqual([2]);
    expect(t.active).toBe(2);
  });

  it("empties the last tab instead of removing it", () => {
    const t = closeTab(createTabs("a"), 1, "empty");
    expect(t.tabs).toEqual([{ id: 1, data: "empty" }]);
    expect(t.active).toBe(1);
  });

  it("cycles with wrap-around", () => {
    let t = addTab(addTab(createTabs("a"), "b"), "c"); // active 3
    t = cycle(t, 1);
    expect(t.active).toBe(1);
    t = cycle(t, -1);
    expect(t.active).toBe(3);
    t = cycle(t, -1);
    expect(t.active).toBe(2);
  });

  it("updates tab data and ignores unknown ids", () => {
    let t = addTab(createTabs("a"), "b");
    t = updateTab(t, 1, "A");
    expect(t.tabs.map((x) => x.data)).toEqual(["A", "b"]);
    expect(activate(t, 99)).toBe(t);
    expect(closeTab(t, 99, "")).toBe(t);
  });
});

describe("tabTitle", () => {
  it("uses the file name, else the start of the snippet", () => {
    expect(tabTitle({ text: "x", name: "C:\\data\\orders.json" })).toBe("orders.json");
    expect(tabTitle({ text: "\n\n  SELECT  *\nFROM t" })).toBe("SELECT *");
    expect(tabTitle({ text: "x".repeat(40) })).toBe("x".repeat(23) + "…");
    expect(tabTitle({ text: "  \n" })).toBe("New tab");
    expect(tabTitle(null)).toBe("New tab");
  });
});
