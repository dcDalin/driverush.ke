import { readdirSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { blogPaths, isPrerendered, prerenderPaths } from "./prerender-paths";
import { SIGN_PAGES, signPagePath } from "./road-sign-pages";

const ROOT = process.cwd();

describe("prerenderPaths", () => {
  const paths = prerenderPaths(
    [
      "/",
      "/road-signs",
      "/model-town-board",
      "/model-town-board/play",
      "/school",
      "/pass",
      "/pass/done",
      "/console",
      "/console/payments",
      "/auth/callback",
      "/s",
      "/tools/og",
      "/api/board-schools",
      "/driving-schools-kenya",
      "/practice",
      "/blogs/ntsa-test-prep-kenya",
      "/sitemap.xml",
    ],
    ROOT,
  );

  it("builds every sign's page and every post the app has", () => {
    for (const sign of SIGN_PAGES) expect(paths).toContain(signPagePath(sign));
    // The unit tests have no MDX plugin, so the posts are counted by file.
    const posts = readdirSync(`${ROOT}/app/blogs`).filter((f) =>
      f.endsWith(".mdx"),
    );
    expect(blogPaths(ROOT)).toHaveLength(posts.length);
    for (const path of blogPaths(ROOT)) expect(paths).toContain(path);
    expect(paths).toContain("/blogs/learning-to-drive-in-kenya");
  });

  it("keeps the public static pages", () => {
    for (const path of [
      "/",
      "/road-signs",
      "/model-town-board",
      "/model-town-board/play",
      "/sitemap.xml",
    ]) {
      expect(paths).toContain(path);
    }
  });

  it("never builds a page about one person, a school's data, the tools or the API", () => {
    for (const path of [
      "/school",
      "/school/abc",
      "/pass",
      "/pass/done",
      "/console",
      "/console/payments",
      "/auth/callback",
      "/s",
      "/tools/og",
      "/api/board-schools",
      "/driving-schools-kenya",
      "/driving-schools-kenya/petanns",
      "/practice",
      "/blogs/ntsa-test-prep-kenya",
    ]) {
      expect(isPrerendered(path)).toBe(false);
      expect(paths).not.toContain(path);
    }
  });

  it("does not catch pages that only start with a private word", () => {
    expect(isPrerendered("/schools-guide")).toBe(true);
    expect(isPrerendered("/passing-tips")).toBe(true);
  });
});
