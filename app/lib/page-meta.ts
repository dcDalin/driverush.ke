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
  "routes/console/overview": { group: "Console", path: "/console" },
  "routes/console/schools": { group: "Console", path: "/console/schools" },
  "routes/console/school-new": {
    group: "Console",
    path: "/console/schools/new",
  },
  "console-school": {
    group: "Console",
    template: "/console/schools/:schoolId",
    path: "/console/schools/:schoolId",
  },
  "routes/console/school-setup": {
    group: "Console",
    template: "/console/schools/:schoolId",
    path: "/console/schools/:schoolId",
  },
  "routes/console/school-setup-index": {
    group: "Console",
    template: "/console/schools/:schoolId",
    path: "/console/schools/:schoolId",
  },
  "routes/console/school-hand-over": {
    group: "Console",
    template: "/console/schools/:schoolId/hand-over",
    path: "/console/schools/:schoolId/hand-over",
  },
  "routes/console/school-status": {
    group: "Console",
    template: "/console/schools/:schoolId/status",
    path: "/console/schools/:schoolId/status",
  },
  "routes/console/school-livery": {
    group: "Console",
    template: "/console/schools/:schoolId/livery",
    path: "/console/schools/:schoolId/livery",
  },
  "routes/console/school-livery-upload": {
    group: "Console",
    template: "/console/schools/:schoolId/livery/upload",
    path: "/console/schools/:schoolId/livery/upload",
  },
  "routes/console/school-livery-confirm": {
    group: "Console",
    template: "/console/schools/:schoolId/livery/:liveryId/:verb",
    path: "/console/schools/:schoolId/livery/:liveryId/:verb",
  },
  "routes/console/school-payments": {
    group: "Console",
    template: "/console/schools/:schoolId/payments",
    path: "/console/schools/:schoolId/payments",
  },
  "routes/console/school-bank-review": {
    group: "Console",
    template: "/console/schools/:schoolId/payments/review/:decision",
    path: "/console/schools/:schoolId/payments/review/:decision",
  },
  "routes/console/school-code": {
    group: "Console",
    template: "/console/schools/:schoolId/payments/code",
    path: "/console/schools/:schoolId/payments/code",
  },
  "routes/console/school-bank": {
    group: "Console",
    template: "/console/schools/:schoolId/payments/bank",
    path: "/console/schools/:schoolId/payments/bank",
  },
  "routes/console/school-sponsorship": {
    group: "Console",
    template: "/console/schools/:schoolId/sponsorship",
    path: "/console/schools/:schoolId/sponsorship",
  },
  "routes/console/school-profile": {
    group: "Console",
    template: "/console/schools/:schoolId/profile",
    path: "/console/schools/:schoolId/profile",
  },
  "console-profile-edit": {
    group: "Console",
    template: "/console/schools/:schoolId/profile/edit",
    path: "/console/schools/:schoolId/profile/edit",
  },
  "console-profile-logo": {
    group: "Console",
    template: "/console/schools/:schoolId/profile/logo/:kind",
    path: "/console/schools/:schoolId/profile/logo/:kind",
  },
  "console-profile-branch": {
    group: "Console",
    template: "/console/schools/:schoolId/profile/branches/:branchId",
    path: "/console/schools/:schoolId/profile/branches/:branchId",
  },
  "routes/console/school-branches": {
    group: "Console",
    template: "/console/schools/:schoolId/branches",
    path: "/console/schools/:schoolId/branches",
  },
  "console-branch-add": {
    group: "Console",
    template: "/console/schools/:schoolId/branches/add",
    path: "/console/schools/:schoolId/branches/add",
  },
  "console-branch-edit": {
    group: "Console",
    template: "/console/schools/:schoolId/branches/:branchId/edit",
    path: "/console/schools/:schoolId/branches/:branchId/edit",
  },
  "routes/console/school-team": {
    group: "Console",
    template: "/console/schools/:schoolId/team",
    path: "/console/schools/:schoolId/team",
  },
  "console-admin-add": {
    group: "Console",
    template: "/console/schools/:schoolId/team/add",
    path: "/console/schools/:schoolId/team/add",
  },
  "console-invite-withdraw": {
    group: "Console",
    template: "/console/schools/:schoolId/team/invites/:inviteId/withdraw",
    path: "/console/schools/:schoolId/team/invites/:inviteId/withdraw",
  },
  "console-admin-change": {
    group: "Console",
    template: "/console/schools/:schoolId/team/:memberId/:verb",
    path: "/console/schools/:schoolId/team/:memberId/:verb",
  },
  "routes/console/school-students": {
    group: "Console",
    template: "/console/schools/:schoolId/students",
    path: "/console/schools/:schoolId/students",
  },
  "routes/console/school-sponsorship-new": {
    group: "Console",
    template: "/console/schools/:schoolId/sponsorship/new",
    path: "/console/schools/:schoolId/sponsorship/new",
  },
  "routes/console/payments": { group: "Console", path: "/console/payments" },
  "routes/console/staff": { group: "Console", path: "/console/staff" },
  "routes/console/staff-grant": {
    group: "Console",
    path: "/console/staff/grant",
  },
  "routes/school/overview": {
    group: "School dashboard",
    template: "/school/:schoolId",
    path: "/school/:schoolId",
  },
  "routes/school/students": {
    group: "School dashboard",
    template: "/school/:schoolId/students",
    path: "/school/:schoolId/students",
  },
  "routes/school/student-add": {
    group: "School dashboard",
    template: "/school/:schoolId/students/add",
    path: "/school/:schoolId/students/add",
  },
  "routes/school/passes": {
    group: "School dashboard",
    template: "/school/:schoolId/passes",
    path: "/school/:schoolId/passes",
  },
  "routes/school/team": {
    group: "School dashboard",
    template: "/school/:schoolId/team",
    path: "/school/:schoolId/team",
  },
  "routes/school/admin-add": {
    group: "School dashboard",
    template: "/school/:schoolId/team/add",
    path: "/school/:schoolId/team/add",
  },
  "routes/school/branches": {
    group: "School dashboard",
    template: "/school/:schoolId/branches",
    path: "/school/:schoolId/branches",
  },
  "routes/school/branch-add": {
    group: "School dashboard",
    template: "/school/:schoolId/branches/add",
    path: "/school/:schoolId/branches/add",
  },
  "routes/school/student-change": {
    group: "School dashboard",
    template: "/school/:schoolId/students/:linkId/:verb",
    path: "/school/:schoolId/students/:linkId/:verb",
  },
  "routes/school/pass-price": {
    group: "School dashboard",
    template: "/school/:schoolId/passes/price",
    path: "/school/:schoolId/passes/price",
  },
  "routes/school/pass-bank": {
    group: "School dashboard",
    template: "/school/:schoolId/passes/bank",
    path: "/school/:schoolId/passes/bank",
  },
  "routes/school/invite-withdraw": {
    group: "School dashboard",
    template: "/school/:schoolId/team/invites/:inviteId/withdraw",
    path: "/school/:schoolId/team/invites/:inviteId/withdraw",
  },
  "routes/school/admin-change": {
    group: "School dashboard",
    template: "/school/:schoolId/team/:memberId/:verb",
    path: "/school/:schoolId/team/:memberId/:verb",
  },
  "routes/school/branch-edit": {
    group: "School dashboard",
    template: "/school/:schoolId/branches/:branchId/edit",
    path: "/school/:schoolId/branches/:branchId/edit",
  },
  "routes/school/profile-edit": {
    group: "School dashboard",
    template: "/school/:schoolId/profile/edit",
    path: "/school/:schoolId/profile/edit",
  },
  "routes/school/profile-logo": {
    group: "School dashboard",
    template: "/school/:schoolId/profile/logo/:kind",
    path: "/school/:schoolId/profile/logo/:kind",
  },
  "routes/school/profile-branch": {
    group: "School dashboard",
    template: "/school/:schoolId/profile/branches/:branchId",
    path: "/school/:schoolId/profile/branches/:branchId",
  },
  "routes/school/profile": {
    group: "School dashboard",
    template: "/school/:schoolId/profile",
    path: "/school/:schoolId/profile",
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
export const KEEP_PARAMS: ReadonlySet<string> = new Set([
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
