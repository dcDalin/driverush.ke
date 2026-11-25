import * as React from "react";
import { Link } from "react-router";
import { Icon } from "~/components/brand/icon";
import { ArrowRightIcon } from "~/components/brand/icons";

import { cn } from "~/lib/utils";
import type { BlogPost } from "~/lib/blog";

type BlogCardProps = React.ComponentProps<"article"> & {
  post: BlogPost;
  /** Compact layout for the related-posts strip. */
  compact?: boolean;
};

/**
 * Newspaper-style post card. Top stub shows category + date, then the title,
 * the lede, and a footer with tone + reading time. Clicks anywhere on the
 * card route to the post — a screen-reader-only "Read" link sits on top so
 * the anchor target is announced clearly.
 */
function BlogCard({ post, compact, className, ...props }: BlogCardProps) {
  return (
    // `h-full` lets the card fill its grid cell; `line-clamp` on the title
    // and lede caps content height so adjacent cards stay the same size
    // regardless of how long the source frontmatter is. `mt-auto` pins the
    // footer to the bottom of the card no matter how short the body is.
    <article
      data-slot="blog-card"
      className={cn(
        "group relative flex h-full flex-col rounded-lg border border-line bg-surface transition focus-within:bg-paper-2 hover:bg-paper-2",
        compact ? "p-5" : "p-6 sm:p-7",
        className,
      )}
      {...props}
    >
      <div className="mb-4 flex items-center justify-between font-sans text-[10.5px] font-medium tracking-wider text-ink-3 uppercase">
        <span className="rounded-full bg-paper-2 px-2.5 py-1 font-semibold tracking-normal text-ink-2 normal-case">
          {post.category}
        </span>
        <time dateTime={post.date}>{formatDate(post.date)}</time>
      </div>

      <h3
        className={cn(
          "m-0 mb-3 font-display leading-[1.05] font-bold tracking-tight text-ink",
          compact
            ? "line-clamp-3 text-lg"
            : "line-clamp-2 text-2xl sm:text-[26px]",
          "[&_em]:font-serif [&_em]:font-normal [&_em]:text-rush [&_em]:normal-case",
        )}
      >
        <Link
          to={`/blogs/${post.slug}`}
          className="outline-none after:absolute after:inset-0 after:content-[''] focus-visible:[&_::after]:outline focus-visible:[&_::after]:outline-2 focus-visible:[&_::after]:outline-rush"
        >
          {post.title}
        </Link>
      </h3>

      <p
        className={cn(
          "m-0 line-clamp-3 font-serif leading-snug text-ink-2",
          compact ? "text-sm" : "text-base",
        )}
      >
        {post.lede}
      </p>

      <div className="mt-auto flex items-center justify-between gap-3 border-t border-line pt-4 font-sans text-[10.5px] font-medium tracking-wider text-ink-3 uppercase">
        <span>{post.readingMinutes} min read</span>
        <span className="inline-flex items-center gap-1.5 text-rush transition-[gap] group-hover:gap-2">
          Read
          <Icon icon={ArrowRightIcon} size={12} />
        </span>
      </div>
    </article>
  );
}

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-KE", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

export { BlogCard, formatDate };
