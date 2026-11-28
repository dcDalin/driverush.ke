/**
 * What a blog page needs in the browser: each post's text, loaded on its own
 * page only (`mdx-bodies.tsx`), and the blog's keywords. The list of posts
 * (`blog.ts`) stays on the server; the routes hand it over in their loaders.
 * A post's file is named by its slug (`app/blogs/<slug>.mdx`).
 */
import { mdxBodies, type MdxModule } from "~/lib/mdx-bodies";

export const BLOG_BODIES = mdxBodies(
  import.meta.glob<MdxModule>("../blogs/*.mdx"),
);

/** The post's MDX file, as `BLOG_BODIES` knows it. */
export function blogFile(slug: string): string {
  return `../blogs/${slug}.mdx`;
}

/** Site-wide blog keywords appended to meta on every blog page. */
export const BLOG_KEYWORDS = [
  "NTSA blog",
  "learning to drive in Kenya",
  "Kenya driving tips",
  "Kenyan road signs explained",
  "Nairobi driving",
  "driving licence Kenya",
  "NTSA test tips",
] as const;
