import * as React from "react";

import { cn } from "~/lib/utils";

type TicketCardProps = Omit<React.ComponentProps<"article">, "title"> & {
  /** Top-left stub label, e.g. "Pass № 01". */
  passLabel?: React.ReactNode;
  /** Top-right seat tag, e.g. "A·01". */
  seat?: React.ReactNode;
  /** Title; pass <em>…</em> to italicize phrases inline (renders as serif rush). */
  title: React.ReactNode;
  /** Body copy. */
  description?: React.ReactNode;
  /** Show the ticket barcode footer (default true). */
  barcode?: boolean;
};

/**
 * Principle ticket card. Top stub (pass label · seat tag) + headline + body
 * + barcode footer. Used in the Principles section and anywhere we want a
 * "ticket-stamped" announcement.
 */
function TicketCard({
  className,
  passLabel,
  seat,
  title,
  description,
  barcode = true,
  ...props
}: TicketCardProps) {
  return (
    <article
      data-slot="ticket-card"
      className={cn("rounded-lg border border-line bg-surface p-7", className)}
      {...props}
    >
      {(passLabel || seat) && (
        <div className="mb-5 flex items-center justify-between font-sans text-[10px] font-medium tracking-wider text-ink-3 uppercase">
          <span>{passLabel}</span>
          {seat && (
            <span className="rounded-full bg-paper-2 px-2.5 py-1 font-semibold tracking-normal text-ink-2 normal-case">
              {seat}
            </span>
          )}
        </div>
      )}
      <h3
        className={cn(
          "m-0 mb-4 font-display text-2xl leading-[0.95] font-semibold tracking-tight text-ink",
          "[&_em]:font-serif [&_em]:font-normal [&_em]:text-rush [&_em]:normal-case",
        )}
      >
        {title}
      </h3>
      {description && (
        <p className="m-0 text-sm leading-relaxed text-ink-2">{description}</p>
      )}
      {barcode && (
        <div
          aria-hidden
          className="mt-6 h-8 bg-[repeating-linear-gradient(90deg,var(--ink)_0_1px,transparent_1px_3px,var(--ink)_3px_5px,transparent_5px_6px,var(--ink)_6px_8px,transparent_8px_12px)]"
        />
      )}
    </article>
  );
}

export { TicketCard };
