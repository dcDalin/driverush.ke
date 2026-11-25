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

type Entry = {
  group: string;
  template?: string;
  /** The route's URL pattern, as in `routes.ts`. A test keeps them equal. */
  path: string;
};

const ROUTES: Record<string, Entry> = {
  "routes/home": { group: "Home", path: "/" },
  "routes/road-signs": { group: "Signs hub", path: "/road-signs" },
  "routes/road-signs-pelican": {
    group: "Sign trainer",
    path: "/road-signs/pelican",
  },
  "routes/road-signs-3d": { group: "Sign trainer", path: "/road-signs/3d" },
  "sign-class-warning": {
    group: "Sign class",
    path: "/road-signs/warning-signs",
  },
  "sign-class-mandatory": {
    group: "Sign class",
    path: "/road-signs/mandatory-signs",
  },
  "sign-class-prohibitory": {
    group: "Sign class",
    path: "/road-signs/prohibitory-signs",
  },
  "routes/road-sign": {
    group: "Sign page",
    template: "/road-signs/:slug",
    path: "/road-signs/:slug",
  },
  "routes/model-town-board": {
    group: "Board guide",
    path: "/model-town-board",
  },
  "routes/board-play": { group: "Board game", path: "/model-town-board/play" },
  "routes/board-levels": {
    group: "Board levels",
    path: "/model-town-board/levels",
  },
  "board-guide-diagram": {
    group: "Board guide",
    path: "/model-town-board/diagram",
  },
  "board-guide-lane-options": {
    group: "Board guide",
    path: "/model-town-board/lane-options",
  },
  "board-guide-questions": {
    group: "Board guide",
    path: "/model-town-board/questions",
  },
  "board-guide-roundabout": {
    group: "Board guide",
    path: "/model-town-board/roundabout",
  },
  "board-guide-rules": {
    group: "Board guide",
    path: "/model-town-board/rules",
  },
  "board-guide-parking": {
    group: "Board guide",
    path: "/model-town-board/parking",
  },
  "routes/guides": { group: "Guide", path: "/guides" },
  "routes/ntsa-test": { group: "NTSA test", path: "/ntsa-test" },
  "routes/ntsa-questions": { group: "NTSA test", path: "/ntsa-test/questions" },
  "routes/driving-schools-kenya": {
    group: "Guide",
    path: "/driving-schools-kenya",
  },
  "routes/driving-school": {
    group: "School page",
    template: "/driving-schools-kenya/:slug",
    path: "/driving-schools-kenya/:slug",
  },
  "routes/derevaprep-alternative": {
    group: "Guide",
    path: "/derevaprep-alternative",
  },
  "routes/about": { group: "Info", path: "/about" },
  "routes/privacy": { group: "Info", path: "/privacy" },
  "routes/blogs": { group: "Blog", path: "/blogs" },
  "routes/blogs-post": {
    group: "Blog",
    template: "/blogs/:slug",
    path: "/blogs/:slug",
  },
  "routes/share-landing": { group: "Share landing", path: "/s" },
  "routes/auth-callback": { group: "Account", path: "/auth/callback" },
  "routes/pass": { group: "Pass", path: "/pass" },
  "routes/pass-done": { group: "Pass", path: "/pass/done" },
  "routes/school-home": { group: "School dashboard", path: "/school" },
  "routes/console": { group: "Console", path: "/console" },
  "routes/school-dashboard": {
    group: "School dashboard",
    template: "/school/:schoolId",
    path: "/school/:schoolId",
  },
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

/** The labelled routes, static paths first so they outrank `:slug` ones. */
const BY_PATH = Object.values(ROUTES)
  .map((entry) => ({
    entry,
    re: new RegExp(
      `^${entry.path.replace(/:[^/]+/g, "[^/]+").replace(/\//g, "\\/")}$`,
    ),
  }))
  .sort(
    (a, b) =>
      Number(a.entry.path.includes(":")) - Number(b.entry.path.includes(":")),
  );

/**
 * The same labels from the URL path alone, for code that runs with no route
 * match to hand: PostHog sends its page view as the URL changes, before
 * React has drawn the new page. An unknown path is "Not found".
 */
export function pageMetaForPath(pathname: string): PageMeta {
  if (INTERNAL_PATH_RE.test(pathname)) {
    return { content_group: "Internal", page_template: pathname };
  }
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  const hit = BY_PATH.find((r) => r.re.test(path))?.entry;
  if (!hit) {
    return { content_group: NOT_FOUND_GROUP, page_template: "(not found)" };
  }
  return { content_group: hit.group, page_template: hit.template ?? path };
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
