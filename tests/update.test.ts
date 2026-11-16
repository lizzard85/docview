import { describe, expect, it } from "vitest";
import { isNoUpdateAvailable } from "../src/update";

describe("isNoUpdateAvailable", () => {
  it("treats a missing or incomplete latest.json as 'no update'", () => {
    expect(isNoUpdateAvailable("Could not fetch a valid release JSON from the remote")).toBe(true);
    expect(isNoUpdateAvailable("the platform `windows-x86_64` was not found on the response `platforms` object")).toBe(true);
  });
  it("reports other errors", () => {
    expect(isNoUpdateAvailable("error sending request: dns error")).toBe(false);
  });
});
