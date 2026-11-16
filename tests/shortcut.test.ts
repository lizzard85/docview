import { describe, expect, it } from "vitest";
import { displayShortcut, storeShortcut } from "../src/shortcut";

describe("displayShortcut", () => {
  it("shows Super as Win on Windows", () => {
    expect(displayShortcut("Super+Alt+V", true)).toBe("Win+Alt+V");
    expect(displayShortcut('Genvejen "Super+Alt+V" kunne ikke registreres', true)).toBe('Genvejen "Win+Alt+V" kunne ikke registreres');
  });
  it("keeps Super elsewhere", () => {
    expect(displayShortcut("Super+Alt+V", false)).toBe("Super+Alt+V");
  });
});

describe("storeShortcut", () => {
  it("maps the Windows key names to Super", () => {
    expect(storeShortcut("Win+Alt+V")).toBe("Super+Alt+V");
    expect(storeShortcut("windows + alt + v")).toBe("Super+alt+v");
    expect(storeShortcut("Meta+Shift+F12")).toBe("Super+Shift+F12");
  });
  it("leaves other shortcuts alone", () => {
    expect(storeShortcut("Ctrl+Shift+F12")).toBe("Ctrl+Shift+F12");
    expect(storeShortcut("Super+Alt+V")).toBe("Super+Alt+V");
  });
});
