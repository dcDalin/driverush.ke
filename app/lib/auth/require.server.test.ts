import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getRequestClient, peekRequestClient } from "./require.server";

describe("getRequestClient", () => {
  beforeEach(() => {
    vi.stubEnv("SUPABASE_URL", "http://127.0.0.1:1");
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("reads the session once per request, for every loader of it", async () => {
    const request = new Request("http://localhost/school/abc");
    expect(peekRequestClient(request)).toBeUndefined();
    const first = getRequestClient(request);
    expect(getRequestClient(request)).toBe(first);
    expect(peekRequestClient(request)).toBe(first);
    // No session cookie: a guest, without asking Supabase.
    expect((await first).caller.signedIn).toBe(false);
  });

  it("reads it again for the next request", () => {
    const a = getRequestClient(new Request("http://localhost/console"));
    const b = getRequestClient(new Request("http://localhost/console"));
    expect(a).not.toBe(b);
  });

  it("keeps a client's pages out of every cache", async () => {
    const { headers } = await getRequestClient(
      new Request("http://localhost/pass"),
    );
    expect(headers.get("Cache-Control")).toBe("private, no-store");
  });
});
