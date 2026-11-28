import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const init = vi.fn();
const capture = vi.fn();
vi.mock("posthog-js", () => ({
  default: { init, capture },
}));

describe("PostHog alongside the page", () => {
  beforeEach(() => {
    vi.resetModules();
    init.mockClear();
    capture.mockClear();
    vi.stubGlobal("window", { location: { pathname: "/" } });
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("queues calls made before it loads, then runs them in order", async () => {
    vi.stubEnv("VITE_PUBLIC_POSTHOG_PROJECT_TOKEN", "phc_test");
    vi.stubEnv("VITE_PUBLIC_POSTHOG_HOST", "https://us.i.posthog.com");
    const { getPostHog, startPostHog, withPostHog } = await import("./posthog");
    expect(getPostHog()).toBeUndefined();
    const order: string[] = [];
    withPostHog((ph) => {
      order.push("first");
      ph.capture("early");
    });
    withPostHog(() => order.push("second"));
    const client = await startPostHog();
    expect(client).toBeDefined();
    expect(init).toHaveBeenCalledTimes(1);
    expect(order).toEqual(["first", "second"]);
    expect(capture).toHaveBeenCalledWith("early");
    // Once up, a call runs at once.
    withPostHog(() => order.push("third"));
    expect(order).toEqual(["first", "second", "third"]);
  });

  it("drops the queue when PostHog is not configured, never throwing in production", async () => {
    vi.stubEnv("VITE_PUBLIC_POSTHOG_PROJECT_TOKEN", "");
    vi.stubEnv("DEV", false);
    const { startPostHog, withPostHog } = await import("./posthog");
    const run = vi.fn();
    withPostHog(run);
    await expect(startPostHog()).resolves.toBeUndefined();
    expect(run).not.toHaveBeenCalled();
    expect(init).not.toHaveBeenCalled();
  });
});
