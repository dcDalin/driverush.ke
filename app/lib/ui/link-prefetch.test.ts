import { afterEach, describe, expect, it, vi } from "vitest";

import { linkPrefetch } from "./link-prefetch";

describe("linkPrefetch", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("fetches ahead on intent by default, and on the server", () => {
    expect(linkPrefetch()).toBe("intent");
    vi.stubGlobal("navigator", { connection: { effectiveType: "4g" } });
    expect(linkPrefetch()).toBe("intent");
  });

  it("waits for the tap on data saver or 2G", () => {
    vi.stubGlobal("navigator", { connection: { saveData: true } });
    expect(linkPrefetch()).toBe("none");
    vi.stubGlobal("navigator", { connection: { effectiveType: "2g" } });
    expect(linkPrefetch()).toBe("none");
    vi.stubGlobal("navigator", { connection: { effectiveType: "slow-2g" } });
    expect(linkPrefetch()).toBe("none");
  });
});
