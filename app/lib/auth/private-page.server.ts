/**
 * Route middleware for pages about one person (dashboards, the pass, the
 * console): whatever the root's `headers` said, the response is never kept
 * by a cache. Middleware runs for every request that matches the route,
 * documents and data requests alike, before and after its loaders, so a
 * child page with no headers of its own is covered too.
 */
import type { MiddlewareFunction } from "react-router";

import { PRIVATE_NO_STORE } from "~/lib/http-cache";

export const privatePage: MiddlewareFunction<Response> = async (_, next) => {
  const response = await next();
  response.headers.set("Cache-Control", PRIVATE_NO_STORE);
  return response;
};
