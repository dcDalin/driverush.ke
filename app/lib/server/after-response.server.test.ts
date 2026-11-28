import { afterEach, describe, expect, it, vi } from "vitest";

import { afterResponse } from "./after-response.server";

const REQUEST_CONTEXT = Symbol.for("@vercel/request-context");
const global = globalThis as Record<symbol, unknown>;

afterEach(() => {
  delete global[REQUEST_CONTEXT];
  vi.restoreAllMocks();
});

describe("afterResponse", () => {
  it("off Vercel, waits for the task", async () => {
    let done = false;
    await afterResponse(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      done = true;
    });
    expect(done).toBe(true);
  });

  it("on Vercel, hands the task to waitUntil and answers at once", async () => {
    const handed: Promise<unknown>[] = [];
    global[REQUEST_CONTEXT] = {
      get: () => ({ waitUntil: (p: Promise<unknown>) => handed.push(p) }),
    };
    let finish!: () => void;
    let done = false;
    await afterResponse(
      () =>
        new Promise<void>((resolve) => {
          finish = () => {
            done = true;
            resolve();
          };
        }),
    );
    expect(handed).toHaveLength(1);
    expect(done).toBe(false);
    finish();
    await handed[0];
    expect(done).toBe(true);
  });

  it("never throws: a failed task is logged", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(
      afterResponse(() => Promise.reject(new Error("Resend is down"))),
    ).resolves.toBeUndefined();
    expect(log).toHaveBeenCalledOnce();
  });

  it("a task that throws before its first await is held too", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(
      afterResponse(() => {
        throw new Error("boom");
      }),
    ).resolves.toBeUndefined();
  });
});
