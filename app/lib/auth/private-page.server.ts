/**
 * Route middleware for pages about one person (dashboards, the pass, the
 * console): whatever the root's `headers` said, the response is never kept
 * by a cache, and it carries the session cookies Supabase refreshed while the
 * loaders ran (`getRequestClient`), even from a loader that forgot to return
 * them. Middleware runs for every request that matches the route, documents
 * and data requests alike, before and after its loaders, so a child page
 * with no headers of its own is covered too.
 */
import type { MiddlewareFunction } from "react-router";

import { peekRequestClient } from "~/lib/auth/require.server";
import { PRIVATE_NO_STORE } from "~/lib/http-cache";

export const privatePage: MiddlewareFunction<Response> = async (
  { request },
  next,
) => {
  const response = await next();
  response.headers.set("Cache-Control", PRIVATE_NO_STORE);
  const client = await peekRequestClient(request)?.catch(() => null);
  if (client) {
    const sent = new Set(response.headers.getSetCookie());
    for (const cookie of client.headers.getSetCookie()) {
      if (!sent.has(cookie)) response.headers.append("Set-Cookie", cookie);
    }
  }
  return response;
};
