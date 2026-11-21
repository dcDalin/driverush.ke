import { describe, expect, it } from "vitest";

import routes from "~/routes";
import { cleanPath, LABELLED_ROUTE_IDS, pageMeta } from "./page-meta";

type RouteEntry = { id?: string; file: string; children?: RouteEntry[] };

/** Route ids as React Router makes them: the given `id`, or the file path. */
function routeIds(entries: RouteEntry[]): { id: string; file: string }[] {
  return entries.flatMap((r) => [
    { id: r.id ?? r.file.replace(/\.[^.]+$/, ""), file: r.file },
    ...routeIds(r.children ?? []),
  ]);
}

/** Routes with no page: redirects, files, layouts. */
const NOT_PAGES = /legacy-redirects|sitemap-xml|board-level-picture|layouts\//;

describe("pageMeta", () => {
  const pages = routeIds(routes as RouteEntry[]).filter(
    (r) => !NOT_PAGES.test(r.file),
  );

  it("labels every page route", () => {
    const unlabelled = pages
      .filter((r) => pageMeta(r.id, "/x").content_group === "Other")
      .map((r) => r.id);
    expect(unlabelled).toEqual([]);
  });

  it("has no labels for routes that no longer exist", () => {
    const ids = new Set(pages.map((r) => r.id));
    expect(LABELLED_ROUTE_IDS.filter((id) => !ids.has(id))).toEqual([]);
  });

  it("uses the pattern for dynamic pages and the path for the rest", () => {
    expect(pageMeta("routes/road-sign", "/road-signs/stop")).toEqual({
      content_group: "Sign page",
      page_template: "/road-signs/:slug",
    });
    expect(pageMeta("routes/board-play", "/model-town-board/play")).toEqual({
      content_group: "Board game",
      page_template: "/model-town-board/play",
    });
  });

  it("calls a page with only the root matched not found", () => {
    expect(pageMeta("root", "/nope").content_group).toBe("Not found");
    expect(pageMeta(undefined, "/nope").content_group).toBe("Not found");
  });

  it("marks the tools as internal", () => {
    expect(pageMeta("routes/tools/og", "/tools/og").content_group).toBe(
      "Internal",
    );
  });
});

describe("cleanPath", () => {
  it("keeps campaign and page keys, drops click ids and payloads", () => {
    expect(
      cleanPath(
        "/model-town-board/play",
        "?level=u1-l3&ttclid=abc&fbclid=x&utm_source=tiktok&ga_debug=1",
      ),
    ).toBe("/model-town-board/play?level=u1-l3&utm_source=tiktok");
    expect(cleanPath("/s", "?k=quiz&n=10&t=abc")).toBe("/s?k=quiz");
  });

  it("returns the bare path when nothing is kept", () => {
    expect(cleanPath("/road-signs", "?igshid=1")).toBe("/road-signs");
    expect(cleanPath("/", "")).toBe("/");
  });
});
