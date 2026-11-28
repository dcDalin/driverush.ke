import { isRouteErrorResponse, Link } from "react-router";

import { BlogPostLayout } from "~/components/brand/blog-post-layout";
import { Rail } from "~/components/brand/rail";
import { Button } from "~/components/ui/button";
import { getPostBySlug, getRelatedPosts } from "~/lib/blog";
import { BLOG_BODIES, BLOG_KEYWORDS, blogFile } from "~/lib/blog-page";
import {
  absUrl,
  breadcrumbLd,
  keywords,
  pageTitle,
  SITE,
  siteWideMeta,
} from "~/lib/site";

import type { Route } from "./+types/blogs-post";

/**
 * Resolves the post by slug (a 404 if unknown) and loads its text, so the
 * page renders whole on the server and in the prerender. The post's data
 * rides in `loaderData`; its MDX body loads on this page only.
 */
export async function loader({ params }: Route.LoaderArgs) {
  const post = getPostBySlug(params.slug);
  if (!post) {
    throw new Response("Not found", { status: 404 });
  }
  await BLOG_BODIES.load(blogFile(post.slug));
  return { post, related: getRelatedPosts(post.slug, 3) };
}

/** On a move from another page: the post's text arrives with its data. */
export async function clientLoader({
  params,
  serverLoader,
}: Route.ClientLoaderArgs) {
  const file = blogFile(params.slug);
  const [data] = await Promise.all([
    serverLoader(),
    BLOG_BODIES.files.includes(file) ? BLOG_BODIES.load(file) : undefined,
  ]);
  return data;
}

export function meta({ loaderData: data }: Route.MetaArgs) {
  if (!data) {
    // 404 path — give the page a clean, non-indexable head.
    return [
      { title: "Post not found · DriveRush Blog" },
      { name: "robots", content: "noindex, follow" },
    ];
  }
  const { post } = data;
  const ownUrl = absUrl(`/blogs/${post.slug}`);
  const ogImage = absUrl(SITE.ogImage);
  // Brand suffix on the SERP title only — the OG/Twitter title keeps the
  // editorial wording clean (post titles often already contain "Kenya" or
  // "NTSA", so an extra suffix in social cards would look spammy).
  const title = pageTitle(post.title);

  return [
    { title },
    { name: "description", content: post.description },
    ...siteWideMeta(),
    {
      name: "keywords",
      content: keywords(...post.tags, ...BLOG_KEYWORDS),
    },
    { tagName: "link", rel: "canonical", href: ownUrl },
    { property: "og:title", content: post.title },
    { property: "og:description", content: post.description },
    { property: "og:url", content: ownUrl },
    { property: "og:type", content: "article" },
    { property: "og:image", content: ogImage },
    { property: "article:published_time", content: post.date },
    { property: "article:modified_time", content: post.updated ?? post.date },
    { property: "article:section", content: post.category },
    ...post.tags.map((t) => ({ property: "article:tag", content: t })),
    { name: "twitter:title", content: post.title },
    { name: "twitter:description", content: post.description },
    { name: "twitter:image", content: ogImage },
    {
      "script:ld+json": breadcrumbLd([
        { name: "Home", url: "/" },
        { name: "Blog", url: "/blogs" },
        { name: post.title, url: `/blogs/${post.slug}` },
      ]),
    },
    {
      "script:ld+json": {
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        headline: post.title,
        description: post.description,
        datePublished: post.date,
        dateModified: post.updated ?? post.date,
        url: ownUrl,
        inLanguage: SITE.lang,
        mainEntityOfPage: { "@type": "WebPage", "@id": ownUrl },
        author: {
          "@type": "Organization",
          name: SITE.name,
          url: SITE.url,
        },
        publisher: {
          "@type": "Organization",
          name: SITE.name,
          url: SITE.url,
          logo: { "@type": "ImageObject", url: absUrl(SITE.logo) },
        },
        image: [ogImage],
        keywords: [...post.tags, ...BLOG_KEYWORDS].join(", "),
        articleSection: post.category,
        wordCount: post.readingMinutes * 220,
      },
    },
  ];
}

export default function BlogPostRoute({ loaderData }: Route.ComponentProps) {
  const { post, related } = loaderData;
  return (
    <BlogPostLayout post={post} related={related}>
      <BLOG_BODIES.Body file={blogFile(post.slug)} />
    </BlogPostLayout>
  );
}

function PostMissing() {
  return (
    <main className="min-h-screen bg-paper text-ink">
      <Rail />
      <div className="mx-auto w-full max-w-2xl px-5 py-24 text-center sm:px-9">
        <p className="m-0 mb-3 font-sans text-[11px] font-medium tracking-wider text-ink-3 uppercase">
          404 · post not found
        </p>
        <h1 className="m-0 mb-5 font-display text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
          That post has moved on.
        </h1>
        <p className="m-0 mb-7 font-serif text-lg leading-snug text-ink-2">
          Back to the dispatch desk. Plenty more to read.
        </p>
        <Button variant="rush" size="lg" asChild>
          <Link to="/blogs">All blog posts</Link>
        </Button>
      </div>
    </main>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  if (isRouteErrorResponse(error) && error.status === 404) {
    return <PostMissing />;
  }
  return (
    <main className="mx-auto max-w-xl px-5 py-16">
      <h1 className="font-display text-3xl font-semibold tracking-tight">
        Something went sideways
      </h1>
      <p className="mt-3 font-serif text-ink-2">
        We hit an unexpected error rendering this post.
      </p>
    </main>
  );
}
