import type * as React from "react";
import { Link } from "react-router";

import { BlogCard, formatDate } from "~/components/brand/blog-card";
import { Icon } from "~/components/brand/icon";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  PelicanIcon,
  Sign3DIcon,
} from "~/components/brand/icons";
import { Rail } from "~/components/brand/rail";
import { ShareButton } from "~/components/brand/share-button";
import { SiteFooter } from "~/components/brand/site-footer";
import { SiteNav } from "~/components/brand/site-nav";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import type { BlogPost } from "~/lib/blog";
import { SITE } from "~/lib/site";
import { linkPrefetch } from "~/lib/ui/link-prefetch";
import { cn } from "~/lib/utils";

type BlogPostLayoutProps = {
  post: BlogPost;
  related: BlogPost[];
  children: React.ReactNode;
};

/** Keeps the trainers one click away, even for readers who never reach the end. */
function TryItNowPanel() {
  return (
    <aside className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-paper-2 px-4 py-3 sm:px-5">
      <div>
        <p className="m-0 font-sans text-[10.5px] font-medium tracking-wider text-ink-3 uppercase">
          Try it now
        </p>
        <p className="m-0 mt-0.5 text-[14px] leading-snug text-ink">
          Memorise your road signs, 10 at a time.
        </p>
      </div>
      <Button variant="rush" size="sm" asChild>
        <Link prefetch={linkPrefetch()} to="/road-signs">
          Start training
          <Icon icon={ArrowRightIcon} size={14} />
        </Link>
      </Button>
    </aside>
  );
}

/**
 * Chrome around the rendered MDX body — top breadcrumb, masthead-style header
 * with kicker / title / lede / byline, a constrained reading column for the
 * post body, then a related-posts strip and a CTA tail. The MDX content is
 * the `children`; everything else lives here.
 */
export function BlogPostLayout({
  post,
  related,
  children,
}: BlogPostLayoutProps) {
  return (
    <>
      <SiteNav />
      <main className="min-h-screen bg-paper text-ink">
        <Rail />

        <div className="mx-auto w-full max-w-3xl px-5 pt-6 pb-24 sm:px-9 sm:pt-10">
          <div className="mb-6 flex items-center justify-between gap-3">
            <Link
              prefetch={linkPrefetch()}
              to="/blogs"
              className="inline-flex items-center gap-2 font-sans text-[11px] font-medium tracking-wider text-ink-3 uppercase outline-none hover:text-ink focus-visible:text-ink"
            >
              <Icon icon={ArrowLeftIcon} size={14} />
              All posts
            </Link>
            <span className="font-sans text-[10.5px] font-medium tracking-wider text-ink-3 uppercase">
              Blog · {post.category}
            </span>
          </div>

          <header className="border-b border-line pb-8">
            <div className="flex items-baseline justify-between border-b border-line pb-2.5 font-sans text-[11px] font-medium tracking-wider text-ink-3 uppercase">
              <span>{post.kicker ?? `${post.category} · ${post.tone}`}</span>
              <time dateTime={post.date}>{formatDate(post.date)}</time>
            </div>

            <h1
              className={cn(
                "m-0 mt-6 font-display leading-[0.92] font-bold tracking-tight text-ink uppercase",
                "text-[clamp(36px,7vw,72px)]",
                "[&_em]:font-serif [&_em]:font-normal [&_em]:text-rush [&_em]:normal-case",
              )}
            >
              {post.title}
            </h1>

            <p className="mt-5 font-serif text-[clamp(17px,2.2vw,22px)] leading-snug text-ink-2">
              {post.lede}
            </p>

            {/* Share sits with the byline, where readers look once they've
                decided the piece is worth passing on. Posts share their own
                canonical URL, not a /s hop, so the link equity stays here. */}
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2 font-sans text-[10.5px] font-medium tracking-wider text-ink-3 uppercase">
                <span>{post.readingMinutes} min read</span>
                <span aria-hidden>·</span>
                <span>
                  By{" "}
                  <Link
                    prefetch={linkPrefetch()}
                    to="/about"
                    className="hover:text-ink hover:underline"
                  >
                    {SITE.byline}
                  </Link>
                </span>
                {post.tags.length > 0 && (
                  <>
                    <span aria-hidden>·</span>
                    <span className="flex flex-wrap gap-1.5">
                      {post.tags.slice(0, 3).map((t) => (
                        <Badge key={t} variant="outline" className="lowercase">
                          {t}
                        </Badge>
                      ))}
                    </span>
                  </>
                )}
              </div>
              <ShareButton
                surface="blog_post"
                size="sm"
                payload={{
                  kind: "page",
                  path: `/blogs/${post.slug}`,
                  title: post.title,
                  text: post.description,
                }}
              />
            </div>
          </header>

          <TryItNowPanel />

          {/* Buttons a post puts in its text never wrap on their own, and a
              long label is wider than a phone: there they wrap and fit. */}
          <article className="pt-8 pb-12 max-sm:[&_[data-slot=button]]:h-auto max-sm:[&_[data-slot=button]]:min-h-14 max-sm:[&_[data-slot=button]]:max-w-full max-sm:[&_[data-slot=button]]:px-4 max-sm:[&_[data-slot=button]]:py-3 max-sm:[&_[data-slot=button]]:text-center max-sm:[&_[data-slot=button]]:whitespace-normal">
            {children}
          </article>

          {/* CTA tail — keep nudging readers toward the live product. */}
          <section className="border-t border-line bg-paper-2 px-5 py-8 sm:px-7">
            <p className="m-0 mb-4 font-sans text-[11px] font-medium tracking-wider text-ink-3 uppercase">
              Stop reading. Practise the signs.
            </p>
            <h2 className="m-0 mb-5 font-display text-2xl leading-[0.98] font-semibold tracking-tight text-ink sm:text-3xl">
              The fastest way to remember Kenyan road signs is{" "}
              <em className="font-serif font-normal text-rush normal-case">
                to play with them
              </em>
              .
            </h2>
            {/* On a phone the buttons wrap their words and fill the width: a
                one-line label is wider than the screen. */}
            <div className="flex flex-wrap gap-3">
              <Button
                variant="rush"
                size="lg"
                asChild
                className="max-sm:h-auto max-sm:min-h-14 max-sm:w-full max-sm:px-4 max-sm:py-3 max-sm:text-center max-sm:whitespace-normal"
              >
                <Link prefetch={linkPrefetch()} to="/road-signs/pelican">
                  <Icon icon={PelicanIcon} size={18} />
                  Train on the Pelican chart
                </Link>
              </Button>
              <Button
                variant="paper"
                size="lg"
                asChild
                className="max-sm:h-auto max-sm:min-h-14 max-sm:w-full max-sm:px-4 max-sm:py-3 max-sm:text-center max-sm:whitespace-normal"
              >
                <Link prefetch={linkPrefetch()} to="/road-signs/3d">
                  <Icon icon={Sign3DIcon} size={18} />
                  Spin signs in 3D
                </Link>
              </Button>
            </div>
          </section>

          {related.length > 0 && (
            <section className="mt-14">
              <div className="mb-5 flex items-baseline justify-between border-b border-line pb-3">
                <h2 className="m-0 font-display text-xl font-semibold tracking-tight text-ink sm:text-2xl">
                  Keep reading
                </h2>
                <Link
                  prefetch={linkPrefetch()}
                  to="/blogs"
                  className="font-sans text-[11px] font-medium tracking-wider text-rush uppercase hover:underline"
                >
                  All posts →
                </Link>
              </div>
              <div className="grid gap-4 sm:auto-rows-fr sm:grid-cols-2 lg:grid-cols-3">
                {related.map((p) => (
                  <BlogCard key={p.slug} post={p} compact />
                ))}
              </div>
            </section>
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
