/**
 * Blog manifest. Reads every `*.mdx` file's frontmatter under `app/blogs/`
 * via Vite's `import.meta.glob` (`eager`, the `frontmatter` export only),
 * validates it and returns a typed, date-sorted list of posts.
 *
 * - Server only (the blog routes' loaders, the sitemap, llms.txt). Each
 *   post's text (the MDX `default` export) loads on its own page only,
 *   through `BLOG_BODIES` in `blog-page.ts`.
 * - The slug is sourced from frontmatter; we fall back to the filename so a
 *   missing slug field is loud, not silent.
 * - Sort order is reverse chronological by `date` (most recent first).
 */

export type BlogTone =
  | "practical"
  | "listicle"
  | "explainer"
  | "candid"
  | "essay"
  | "first-person"
  | "literary"
  | "service-piece"
  | "tactical"
  | "observational";

export type BlogCategory =
  "NTSA" | "Road signs" | "Driving in Kenya" | "Licensing" | "Skills";

/** A single FAQ pair, surfaced as visible content + FAQPage JSON-LD. */

export type BlogFrontmatter = {
  title: string;
  description: string;
  slug: string;
  /** ISO date, YYYY-MM-DD. */
  date: string;
  /** ISO date of the last real content change, if there has been one. */
  updated?: string;
  readingMinutes: number;
  tone: BlogTone;
  category: BlogCategory;
  /** Short tags for related-post matching. */
  tags: string[];
  /** One-line standfirst shown under the title. */
  lede: string;
  /** Optional kicker, e.g. "Issue № 03 · Licensing". */
  kicker?: string;
};

export type BlogPost = BlogFrontmatter;

/**
 * Every post's frontmatter, read when this module loads (the index, related
 * posts, the sitemap need them all). Server only: the blog routes read it in
 * their loaders and hand the browser the posts it shows, so this module (and
 * through it every post's chunk) never reaches the browser. Each post's text
 * loads on its own page (`blog-page.ts`).
 */
const FRONTMATTER = import.meta.glob<Partial<BlogFrontmatter>>(
  "../blogs/*.mdx",
  { eager: true, import: "frontmatter" },
);

function pathToFallbackSlug(path: string) {
  return path
    .replace(/^.*\//, "")
    .replace(/\.mdx$/, "")
    .toLowerCase();
}

function assertFrontmatter(
  path: string,
  fm: Partial<BlogFrontmatter> | undefined,
): BlogFrontmatter {
  if (!fm) {
    throw new Error(`Blog post ${path} is missing frontmatter`);
  }
  const required: (keyof BlogFrontmatter)[] = [
    "title",
    "description",
    "date",
    "readingMinutes",
    "tone",
    "category",
    "lede",
  ];
  for (const key of required) {
    if (fm[key] == null) {
      throw new Error(`Blog post ${path} is missing frontmatter.${key}`);
    }
  }
  return {
    ...fm,
    slug: fm.slug ?? pathToFallbackSlug(path),
    tags: fm.tags ?? [],
  } as BlogFrontmatter;
}

const ALL: BlogPost[] = Object.entries(FRONTMATTER)
  .map(([path, frontmatter]) => ({
    ...assertFrontmatter(path, frontmatter),
  }))
  .sort((a, b) => (a.date < b.date ? 1 : -1));

/** All posts, newest first. */
export function getAllPosts(): BlogPost[] {
  return ALL;
}

/** Resolve a single post by its slug, or `undefined` if unknown. */
export function getPostBySlug(slug: string): BlogPost | undefined {
  return ALL.find((p) => p.slug === slug);
}

/**
 * Picks up to `limit` related posts by tag overlap, breaking ties by recency.
 * Excludes the source post itself. If nothing shares a tag, returns the next
 * most recent posts so the related strip is never empty.
 */
export function getRelatedPosts(slug: string, limit = 3): BlogPost[] {
  const source = getPostBySlug(slug);
  if (!source) return ALL.slice(0, limit);

  const scored = ALL.filter((p) => p.slug !== slug).map((p) => {
    const overlap = p.tags.filter((t) => source.tags.includes(t)).length;
    return { post: p, score: overlap };
  });

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.post.date < b.post.date ? 1 : -1;
  });

  return scored.slice(0, limit).map((s) => s.post);
}
