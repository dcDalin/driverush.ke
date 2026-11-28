import { describe, expect, it } from "vitest";

import { freeLabel, freeLine } from "./free-copy";

describe("what the site says about price", () => {
  it("is plainly free while passes are off", () => {
    expect(freeLabel(false)).toBe("Free");
    expect(freeLine(false)).toBe("Free. No account needed to start.");
  });
  it("names the free levels once passes are on sale", () => {
    expect(freeLabel(true)).toBe("First 16 levels free");
    expect(freeLine(true)).not.toMatch(/every level/i);
  });
});
