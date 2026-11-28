import type * as React from "react";

import { cn } from "~/lib/utils";

type SectionHeadProps = Omit<React.ComponentProps<"div">, "title"> & {
  /** Section number, e.g. "01", "02·b". Renders italic rush. */
  num: string;
  /** Section title; pass <em>…</em> to italicize phrases inline. */
  title: React.ReactNode;
  /** Right-aligned mono caps stamp — small kicker copy. */
  stamp?: React.ReactNode;
  /** Optional standfirst line below the head. */
  lede?: React.ReactNode;
};

/**
 * Numbered section head matching the design system's masthead grammar.
 * 80px italic rush number, Sora caps title (with optional inline serif em),
 * mono caps stamp on the right, dashed underline.
 */
function SectionHead({
  className,
  num,
  title,
  stamp,
  lede,
  ...props
}: SectionHeadProps) {
  return (
    <div data-slot="section-head" className={cn("mb-6", className)} {...props}>
      <div className="grid grid-cols-[60px_1fr_auto] items-baseline gap-4 border-b border-line pb-4 sm:grid-cols-[80px_1fr_auto]">
        <span
          aria-hidden
          className="font-display text-4xl leading-none font-semibold tracking-[-0.04em] text-rush sm:text-[56px]"
        >
          {num}
        </span>
        <h2 className="m-0 font-display text-[clamp(28px,4vw,52px)] leading-[0.96] font-semibold tracking-tight text-ink [&_em]:font-serif [&_em]:text-[0.78em] [&_em]:font-normal [&_em]:tracking-normal [&_em]:text-ink-3 [&_em]:normal-case">
          {title}
        </h2>
        {stamp && (
          <div className="hidden text-right font-sans text-[11px] font-medium tracking-wider text-ink-3 uppercase sm:block">
            {stamp}
          </div>
        )}
      </div>
      {lede && (
        <p className="mt-6 max-w-2xl font-serif text-[clamp(16px,2vw,22px)] leading-snug text-ink-2">
          {lede}
        </p>
      )}
    </div>
  );
}

export { SectionHead };
