/**
 * Shared MDX component mapping. The MDX provider import source is configured
 * in `vite.config.ts`; every `.mdx` module imports `useMDXComponents` from
 * here at compile time, so any element a post uses without a JSX tag (plain
 * markdown `h1`, `p`, `a`, etc.) flows through these brand-aligned renderers.
 *
 * Blog posts can still import and place brand components inline — this only
 * styles the markdown shapes.
 */
import type * as React from "react";
import { Link } from "react-router";

import { linkPrefetch } from "~/lib/ui/link-prefetch";
import { cn } from "~/lib/utils";

type AnchorProps = React.ComponentProps<"a">;

/** Internal links go through React Router so SPA transitions are kept. */
function MdxLink({ href, className, children, ...rest }: AnchorProps) {
  const isInternal = href?.startsWith("/") || href?.startsWith("#");
  const classes = cn(
    "font-semibold text-rush decoration-rush/40 underline-offset-[3px] hover:underline hover:decoration-rush focus-visible:underline",
    className,
  );

  if (isInternal && href) {
    return (
      <Link prefetch={linkPrefetch()} to={href} className={classes}>
        {children}
      </Link>
    );
  }
  return (
    <a
      href={href}
      className={classes}
      target="_blank"
      rel="noopener noreferrer"
      {...rest}
    >
      {children}
    </a>
  );
}

/**
 * The styled elements, for components that MDX places but that build their own
 * markup (a JSX `<p>` inside a component skips the mapping): use
 * `MDX.p`, `MDX.h2`, `MDX.table` and so on to match the page around them.
 */
export const MDX = {
  h1: ({ children, ...props }: React.ComponentProps<"h1">) => (
    <h1
      {...props}
      className={cn(
        "m-0 mb-6 font-display text-[clamp(36px,6vw,64px)] leading-[0.92] font-semibold tracking-tight text-ink",
        "[&_em]:font-serif [&_em]:font-normal [&_em]:text-rush [&_em]:normal-case",
        props.className,
      )}
    >
      {children}
    </h1>
  ),
  table: (props: React.ComponentProps<"table">) => (
    <div className="my-6 overflow-x-auto">
      <table
        {...props}
        className="w-full min-w-[520px] border-collapse border border-line font-sans text-[14.5px] leading-snug"
      />
    </div>
  ),
  th: (props: React.ComponentProps<"th">) => (
    <th
      {...props}
      className="border border-line bg-paper-2 px-3 py-2 text-left font-display text-[11.5px] font-bold tracking-wide text-ink uppercase"
    />
  ),
  td: (props: React.ComponentProps<"td">) => (
    <td
      {...props}
      className="border border-line px-3 py-2 align-top text-ink-2"
    />
  ),
  h2: ({ children, ...props }: React.ComponentProps<"h2">) => (
    <h2
      {...props}
      className={cn(
        "mt-14 mb-4 border-b border-line pb-3 font-display text-[clamp(24px,3.4vw,36px)] leading-[1.02] font-semibold tracking-tight text-ink",
        "[&_em]:font-serif [&_em]:font-normal [&_em]:text-rush [&_em]:normal-case",
        props.className,
      )}
    >
      {children}
    </h2>
  ),
  h3: ({ children, ...props }: React.ComponentProps<"h3">) => (
    <h3
      {...props}
      className={cn(
        "mt-10 mb-3 font-display text-xl font-bold tracking-tight text-ink",
        "[&_em]:font-serif [&_em]:font-normal [&_em]:text-rush [&_em]:normal-case",
        props.className,
      )}
    >
      {children}
    </h3>
  ),
  p: (props: React.ComponentProps<"p">) => (
    <p
      {...props}
      className={cn(
        "my-4 font-serif text-[17px] leading-relaxed text-ink-2",
        "[&_em]:text-rush [&_em]:not-italic",
        props.className,
      )}
    />
  ),
  ul: (props: React.ComponentProps<"ul">) => (
    <ul
      {...props}
      className={cn(
        "my-5 list-none space-y-2 border-l border-line pl-5 font-serif text-[17px] leading-relaxed text-ink-2",
        "[&_li]:relative [&_li]:pl-5",
        "[&_li]:before:absolute [&_li]:before:top-[0.7em] [&_li]:before:left-0 [&_li]:before:size-2 [&_li]:before:bg-rush",
        props.className,
      )}
    />
  ),
  ol: (props: React.ComponentProps<"ol">) => (
    <ol
      {...props}
      className={cn(
        "my-5 list-decimal space-y-2 pl-7 font-serif text-[17px] leading-relaxed text-ink-2 marker:font-display marker:font-bold marker:text-rush",
        props.className,
      )}
    />
  ),
  li: (props: React.ComponentProps<"li">) => <li {...props} />,
  a: MdxLink,
  blockquote: (props: React.ComponentProps<"blockquote">) => (
    <blockquote
      {...props}
      className={cn(
        "my-7 border-l border-rush bg-paper-2 px-5 py-4 font-serif text-[19px] leading-snug text-ink",
        "[&_p]:m-0 [&_p]:text-[1.05em] [&_p]:text-ink",
        props.className,
      )}
    />
  ),
  hr: (props: React.ComponentProps<"hr">) => (
    <hr
      {...props}
      className={cn("my-12 h-0 border-0 border-t border-line", props.className)}
    />
  ),
  code: (props: React.ComponentProps<"code">) => (
    <code
      {...props}
      className={cn(
        "rounded-none border border-line bg-paper-2 px-1.5 py-0.5 font-mono text-[13px] text-ink",
        props.className,
      )}
    />
  ),
  pre: (props: React.ComponentProps<"pre">) => (
    <pre
      {...props}
      className={cn(
        "my-6 overflow-x-auto rounded-lg border border-line bg-paper-2 p-4 font-mono text-[13px] leading-relaxed text-ink",
        props.className,
      )}
    />
  ),
  strong: (props: React.ComponentProps<"strong">) => (
    <strong {...props} className={cn("font-bold text-ink", props.className)} />
  ),
} as const;

/**
 * MDX provider import source hook. The MDX runtime calls this for every
 * compiled `.mdx` module; merging caller-supplied components lets a single
 * post override one element if it ever needs to.
 */
export function useMDXComponents(extra: Record<string, unknown> = {}) {
  return { ...MDX, ...extra };
}
