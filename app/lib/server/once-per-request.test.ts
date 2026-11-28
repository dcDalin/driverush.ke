import { describe, expect, it, vi } from "vitest";

import { oncePerRequest } from "./once-per-request";

describe("oncePerRequest", () => {
  it("reads once for every loader of a request, and again for the next", async () => {
    const read = vi.fn(async () => ["bank"]);
    const request = new Request("http://localhost/console");
    const [a, b] = await Promise.all([
      oncePerRequest(request, "banks", read),
      oncePerRequest(request, "banks", read),
    ]);
    expect(a).toBe(b);
    expect(read).toHaveBeenCalledTimes(1);
    await oncePerRequest(
      new Request("http://localhost/console"),
      "banks",
      read,
    );
    expect(read).toHaveBeenCalledTimes(2);
  });
});
