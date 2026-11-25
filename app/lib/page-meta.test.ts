import { describe, expect, it } from "vitest";

import routes from "~/routes";

import {
  cleanPath,
  LABELLED_ROUTE_IDS,
  pageMeta,
  pageMetaForPath,
} from "./page-meta";

type RouteEntry = {
  id?: string;
  file: string;
  path?: string;
  children?: RouteEntry[];
};

/** Route ids as React Router makes them: the given `id`, or the file path. */
function routeIds(entries: RouteEntry[]): { id: string; file: string }[] {
  return entries.flatMap((r) => [
    { id: r.id ?? r.file.replace(/\.[^.]+$/, ""), file: r.file },
    ...routeIds(r.children ?? []),
  ]);
}

/** Routes with no page: redirects, files, layouts, and the routes/api fetchers. */
const NOT_PAGES =
  /legacy-redirects|sitemap-xml|llms-txt|layouts\/|routes\/api\//;

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

describe("pageMetaForPath", () => {
  /** Every page route with a path, as a URL a learner could open. */
  const pages = (routes as RouteEntry[])
    .filter((r) => r.path != null && !NOT_PAGES.test(r.file))
    .filter((r) => !r.file.startsWith("routes/tools/"))
    .map((r) => ({
      id: r.id ?? r.file.replace(/\.[^.]+$/, ""),
      url: `/${r.path!.replace(/:[^/]+/g, "sample")}`,
    }));

  it("labels every page by its path as its route id does", () => {
    expect(pages.length).toBeGreaterThan(20);
    for (const { id, url } of pages) {
      expect({ url, ...pageMetaForPath(url) }).toEqual({
        url,
        ...pageMeta(id, url),
      });
    }
  });

  it("finds the home page, trailing slashes and fixed pages over :slug", () => {
    expect(pageMetaForPath("/").content_group).toBe("Home");
    expect(pageMetaForPath("/road-signs/pelican/").content_group).toBe(
      "Sign trainer",
    );
    expect(pageMetaForPath("/road-signs/warning-signs").content_group).toBe(
      "Sign class",
    );
    expect(pageMetaForPath("/road-signs/stop")).toEqual({
      content_group: "Sign page",
      page_template: "/road-signs/:slug",
    });
  });

  it("calls an unknown path not found and the tools internal", () => {
    expect(pageMetaForPath("/nope/at/all").content_group).toBe("Not found");
    expect(pageMetaForPath("/tools/og").content_group).toBe("Internal");
  });
});
