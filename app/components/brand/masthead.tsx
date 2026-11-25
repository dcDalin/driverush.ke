import * as React from "react";

import { cn } from "~/lib/utils";

type MastheadProps = Omit<React.ComponentProps<"header">, "title"> & {
  /** Top-left mono kicker, e.g. "Volume 01 · Edition 02". */
  kicker?: React.ReactNode;
  /** Center stamp, e.g. "★ DriveRush · Brand Programme ★". */
  stamp?: React.ReactNode;
  /** Top-right mono kicker, e.g. "Nairobi · 26.04.2026". */
  dateline?: React.ReactNode;
  /** The huge masthead title. Use <em>…</em> for italic rush, <span data-out>…</span> for outline. */
  title?: React.ReactNode;
  /** Three-column standfirst: left col, center lede, right col. */
  leftCol?: React.ReactNode;
  centerLede?: React.ReactNode;
  rightCol?: React.ReactNode;
};

/**
 * Newspaper masthead block. Used at the top of marketing pages and the
 * /design route. The title is hand-composed via JSX so callers control
 * which words go red, italic, or outlined.
 *
 * @example
 *   <Masthead
 *     kicker="Volume 01 · Edition 02"
 *     stamp="★ DriveRush · Brand Programme ★"
 *     dateline="Nairobi · 26.04.2026"
 *     title={<>Drive<em>Rush</em> <span data-out>Manual</span></>}
 *     centerLede="Pages of color, type and craft for an NTSA prep app made here."
 *   />
 */
function Masthead({
  className,
  kicker,
  stamp,
  dateline,
  title,
  leftCol,
  centerLede,
  rightCol,
  ...props
}: MastheadProps) {
  return (
    <header
      data-slot="masthead"
      className={cn("border-b border-line pt-6", className)}
      {...props}
    >
      {(kicker || stamp || dateline) && (
        <div className="flex items-baseline justify-between gap-3 border-b border-line pb-2.5 font-sans text-[11px] font-medium tracking-wider text-ink-3 uppercase">
          <span>{kicker}</span>
          {stamp && (
            <span className="bg-rush px-2.5 py-1 font-bold tracking-[0.2em] text-white">
              {stamp}
            </span>
          )}
          <span>{dateline}</span>
        </div>
      )}

      {title && (
        <div className="border-b border-line py-6 text-center">
          <h1
            className={cn(
              "m-0 font-display font-bold",
              "text-[clamp(56px,11vw,168px)] leading-[0.84] tracking-[-0.045em]",
              "[&_em]:text-rush [&_em]:not-italic",
              "[&_[data-out]]:text-transparent",
              "[&_[data-out]]:[-webkit-text-stroke:2px_var(--ink)]",
            )}
          >
            {title}
          </h1>
        </div>
      )}

      {(leftCol || centerLede || rightCol) && (
        <div className="grid items-start gap-5 py-5 md:grid-cols-[1fr_2px_2fr_2px_1fr]">
          <div className="font-sans text-xs font-medium tracking-wider text-ink-3 uppercase">
            {leftCol}
          </div>
          <div className="hidden bg-ink md:block" aria-hidden />
          {centerLede && (
            <p className="m-0 font-serif text-[clamp(18px,2.4vw,30px)] leading-tight text-ink [&_em]:text-rush [&_em]:not-italic">
              {centerLede}
            </p>
          )}
          <div className="hidden bg-ink md:block" aria-hidden />
          <div className="font-sans text-xs font-medium tracking-wider text-ink-3 uppercase">
            {rightCol}
          </div>
        </div>
      )}
    </header>
  );
}

export { Masthead };
