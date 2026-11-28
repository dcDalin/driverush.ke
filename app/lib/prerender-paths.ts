/**
 * Which pages are built as files at deploy time (`react-router.config.ts`
 * `prerender`): every public page that is the same for every visitor. Vercel
 * serves them from its edge with no function run, and a move between them
 * reads a static `.data` file.
 *
 * Read by the config outside the app's build (no `~/` paths, no MDX plugin),
 * so this file reads the sign data and the blog files from disk and imports
 * nothing but dependency-free helpers.
 *
 * Never prerendered: pages about one person, pages drawn from data that
 * changes (a school's own page), the share landing (its query is the page),
 * the authoring tools, the API, and retired addresses that only redirect.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { signSlug } from "./sign-slug";

/** Matched against a path; a match is rendered on request instead. */
export const NEVER_PRERENDERED: readonly RegExp[] = [
  /^\/(s|pass|school|console|auth|tools|api)(\/|$)/,
  /^\/driving-schools-kenya(\/|$)/,
  // Retired addresses (`legacy-redirects.ts`); Vercel redirects them first.
  /^\/(practice|ntsa|design)$/,
  /^\/blogs\/(ntsa-test-prep-kenya|driving-schools-in-kenya)$/,
];

export function isPrerendered(path: string): boolean {
  return !NEVER_PRERENDERED.some((pattern) => pattern.test(path));
}

/** Every sign's page, from the chart's data (`road-sign-pages.ts`). */
export function signPaths(root: string): string[] {
  const chart = JSON.parse(
    readFileSync(join(root, "app/data/road-signs-pelican.json"), "utf8"),
  ) as { regions: { name?: string }[] };
  return chart.regions.map(
    (region) => `/road-signs/${signSlug(region.name ?? "")}`,
  );
}

/** Every blog post, by the slug in its frontmatter or its file name (`blog.ts`). */
export function blogPaths(root: string): string[] {
  const dir = join(root, "app/blogs");
  return readdirSync(dir)
    .filter((file) => file.endsWith(".mdx"))
    .map((file) => {
      const text = readFileSync(join(dir, file), "utf8");
      const slug =
        /^---[\s\S]*?^slug:\s*"?([^"\n]+?)"?\s*$/m.exec(text)?.[1] ??
        file.replace(/\.mdx$/, "").toLowerCase();
      return `/blogs/${slug}`;
    });
}

/**
 * The pages to build: React Router's routes without parameters, plus every
 * sign and post, less the ones that are rendered on request.
 */
export function prerenderPaths(staticPaths: readonly string[], root: string) {
  const all = [...staticPaths, ...signPaths(root), ...blogPaths(root)];
  return [...new Set(all)].filter(isPrerendered).sort();
}
