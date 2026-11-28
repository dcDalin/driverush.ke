import { RouterContextProvider } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { privatePage } from "./private-page.server";
import { getRequestClient } from "./require.server";

const args = (request: Request) =>
  ({
    request,
    url: new URL(request.url),
    params: {},
    pattern: "",
    context: new RouterContextProvider(),
  }) as Parameters<typeof privatePage>[0];

/** Runs the middleware around a page that answers with `page()`. */
const run = async (request: Request, page: () => Promise<Response>) =>
  (await privatePage(args(request), page)) as Response;

describe("privatePage", () => {
  beforeEach(() => {
    vi.stubEnv("SUPABASE_URL", "http://127.0.0.1:1");
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("keeps the page out of every cache, whatever the root said", async () => {
    const response = await run(
      new Request("http://localhost/pass"),
      async () =>
        new Response("ok", {
          headers: { "Cache-Control": "public, s-maxage=3600" },
        }),
    );
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("sends the cookies Supabase refreshed, once", async () => {
    const request = new Request("http://localhost/school/abc");
    const client = await getRequestClient(request);
    client.headers.append("Set-Cookie", "sb-access=new; Path=/");
    const response = await run(request, async () => {
      // One loader returned them, another did not.
      const page = new Response("ok");
      page.headers.append("Set-Cookie", "sb-access=new; Path=/");
      return page;
    });
    expect(response.headers.getSetCookie()).toEqual(["sb-access=new; Path=/"]);
  });

  it("adds them when no loader returned them", async () => {
    const request = new Request("http://localhost/console");
    const client = await getRequestClient(request);
    client.headers.append("Set-Cookie", "sb-refresh=r; Path=/");
    const response = await run(request, async () => new Response("ok"));
    expect(response.headers.getSetCookie()).toEqual(["sb-refresh=r; Path=/"]);
  });
});
