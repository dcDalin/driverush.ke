/**
 * What kind of page this is, for analytics. Pure, so it runs the same on the
 * server (the landing page view is sent from the `<head>`) and in the browser
 * (every navigation after it).
 *
 * Two labels go on every Google Analytics page view:
 *
 *  - `content_group`: a handful of buckets ("Sign page", "Board game") that
 *    GA4 reports on out of the box. 83 sign pages read as one line.
 *  - `page_template`: the route's pattern (`/road-signs/:slug`), so a report
 *    can be split by template without regex over raw paths.
 *
 * Keyed by React Router route id (the `id` in `routes.ts`, or the file path
 * without its extension). A route missing here falls back to "Other", and a
 * test fails, so new pages can't slip in unlabelled.
 */

export type PageMeta = { content_group: string; page_template: string };

/** No route matched: only `root` is in the matches. */
export const NOT_FOUND_GROUP = "Not found";

type Entry = { group: string; template?: string };

const ROUTES: Record<string, Entry> = {
  "routes/home": { group: "Home" },
  "routes/road-signs": { group: "Signs hub" },
  "routes/road-signs-pelican": { group: "Sign trainer" },
  "routes/road-signs-3d": { group: "Sign trainer" },
  "sign-class-warning": { group: "Sign class" },
  "sign-class-mandatory": { group: "Sign class" },
  "sign-class-prohibitory": { group: "Sign class" },
  "routes/road-sign": { group: "Sign page", template: "/road-signs/:slug" },
  "routes/model-town-board": { group: "Board guide" },
  "routes/board-play": { group: "Board game" },
  "routes/board-levels": { group: "Board levels" },
  "board-guide-diagram": { group: "Board guide" },
  "board-guide-lane-options": { group: "Board guide" },
  "board-guide-questions": { group: "Board guide" },
  "board-guide-roundabout": { group: "Board guide" },
  "board-guide-rules": { group: "Board guide" },
  "board-guide-parking": { group: "Board guide" },
  "routes/guides": { group: "Guide" },
  "routes/ntsa-test": { group: "NTSA test" },
  "routes/ntsa-questions": { group: "NTSA test" },
  "routes/driving-schools-kenya": { group: "Guide" },
  "routes/derevaprep-alternative": { group: "Guide" },
  "routes/about": { group: "Info" },
  "routes/privacy": { group: "Info" },
  "routes/blogs": { group: "Blog" },
  "routes/blogs-post": { group: "Blog", template: "/blogs/:slug" },
  "routes/share-landing": { group: "Share landing" },
};

/** Labels for the page whose deepest matched route is `routeId`. */
export function pageMeta(
  routeId: string | undefined,
  pathname: string,
): PageMeta {
  if (!routeId || routeId === "root") {
    return { content_group: NOT_FOUND_GROUP, page_template: "(not found)" };
  }
  if (routeId.startsWith("routes/tools/")) {
    return { content_group: "Internal", page_template: pathname };
  }
  const entry = ROUTES[routeId];
  return {
    content_group: entry?.group ?? "Other",
    page_template: entry?.template ?? pathname,
  };
}

/** Route ids `pageMeta` knows by name. For the test that keeps it complete. */
export const LABELLED_ROUTE_IDS = Object.keys(ROUTES);

/**
 * Query keys that say what is on the page or where the visit came from. Every
 * other key (`ttclid`, `fbclid`, share payloads, `ga_debug`) is dropped, so
 * one page doesn't fragment into hundreds of rows in GA reports.
 */
const KEEP_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
  "gclid",
  // The game: which level, which task, or the board to explore.
  "level",
  "task",
  "learn",
  // The share landing: what kind of thing was shared.
  "k",
]);

/** `pathname + search` with only the keys worth reporting on. */
export function cleanPath(pathname: string, search: string): string {
  const params = new URLSearchParams(search);
  const kept = new URLSearchParams();
  for (const [key, value] of params) {
    if (KEEP_PARAMS.has(key)) kept.append(key, value);
  }
  const query = kept.toString();
  return query ? `${pathname}?${query}` : pathname;
}

/** Internal authoring tools: never sent to Google Analytics. */
export const INTERNAL_PATH_RE = /^\/tools(\/|$)/;
