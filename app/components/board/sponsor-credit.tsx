/**
 * Where a sponsoring driving school is named on screen. Each place is quiet
 * and never covers a drive:
 *
 * - `SponsorCredit`: one line with the school's logo ("Car by ...",
 *   "Board by ..."), for the loader and the settings.
 * - `SponsorReadyCard`: after the mock test and at the end of the course,
 *   the moment a learner needs a real school, "Book lessons with ...".
 *
 * Every one counts itself as seen once per visit (`sponsorShown`).
 */
import * as React from "react";

import type { Sponsor, SponsorPlace } from "~/lib/board/sponsors";
import { sponsorLinkClicked, sponsorShown } from "~/lib/board/sponsor-visit";
import { cn } from "~/lib/utils";

import { Button } from "~/components/ui/button";

function useSeen(sponsor: Sponsor | null, place: SponsorPlace) {
  React.useEffect(() => sponsorShown(sponsor, place), [sponsor, place]);
}

export function SponsorCredit({
  sponsor,
  lead,
  place,
  className,
}: {
  sponsor: Sponsor | null;
  /** The words before the school's name, e.g. "Car by". */
  lead: string;
  place: SponsorPlace;
  className?: string;
}) {
  useSeen(sponsor, place);
  if (!sponsor) return null;
  const body = (
    <>
      <img
        src={sponsor.logo.full}
        alt=""
        className="h-6 w-auto shrink-0 object-contain"
        loading="lazy"
      />
      <span className="min-w-0">
        {lead} <span className="font-semibold">{sponsor.school}</span>
      </span>
    </>
  );
  const line = "m-0 flex items-center gap-2 text-[12.5px] leading-snug";
  return sponsor.url ? (
    <a
      href={sponsor.url}
      target="_blank"
      rel="noopener"
      onClick={() => sponsorLinkClicked(sponsor, place)}
      className={cn(line, "underline-offset-2 hover:underline", className)}
    >
      {body}
    </a>
  ) : (
    <p className={cn(line, className)}>{body}</p>
  );
}

export function SponsorReadyCard({
  sponsor,
  ready,
  className,
}: {
  sponsor: Sponsor | null;
  /** The learner did well: say they look ready. Otherwise offer practice. */
  ready: boolean;
  className?: string;
}) {
  useSeen(sponsor, "ready_card");
  if (!sponsor) return null;
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-2 rounded-md border-2 border-ink/15 bg-paper-2 p-3 text-center text-ink",
        className,
      )}
    >
      <img
        src={sponsor.logo.full}
        alt={sponsor.school}
        className="h-12 w-auto max-w-full object-contain"
        loading="lazy"
      />
      <p className="m-0 text-[13.5px] font-semibold leading-snug">
        {ready
          ? "Ready for the real test? Book lessons on a real board."
          : "Want an instructor to go over it with you on a real board?"}
      </p>
      {sponsor.url ? (
        <Button variant="ink" asChild className="w-full">
          <a
            href={sponsor.url}
            target="_blank"
            rel="noopener"
            onClick={() => sponsorLinkClicked(sponsor, "ready_card")}
          >
            Book lessons with {sponsor.school}
          </a>
        </Button>
      ) : (
        <p className="m-0 text-[12.5px] leading-snug text-ink-2">
          Ask {sponsor.school} about lessons.
        </p>
      )}
    </div>
  );
}
