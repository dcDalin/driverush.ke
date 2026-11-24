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

import {
  SPONSORS,
  type Sponsor,
  type SponsorPlace,
} from "~/lib/board/sponsors";
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

/** The live schools' names as one English list ("A, B and C"). */
export function boardSchoolNames(): string {
  return new Intl.ListFormat("en", { type: "conjunction" }).format(
    SPONSORS.filter((s) => s.live).map((s) => s.school),
  );
}

/**
 * Every live school on the board, for the site footer and the About page:
 * their logos on white tiles, each a link to the school's site when it has
 * one. The cars on the board wear these schools' colours, so the site says
 * whose they are.
 */
export function BoardSchools({
  place = "footer",
  onInk = true,
  className,
}: {
  /** Where the row is, for `sponsor_link_clicked`. */
  place?: Extract<SponsorPlace, "footer" | "about">;
  /** On the ink footer the tile's edge takes the footer's ink. */
  onInk?: boolean;
  className?: string;
}) {
  const schools = SPONSORS.filter((s) => s.live);
  if (schools.length === 0) return null;
  // The school's logo is a 1024 x 401 lockup: tiles keep its shape, and the
  // edge keeps a white tile visible in either theme.
  const tile = cn(
    "flex aspect-[1024/401] w-full items-center justify-center overflow-hidden rounded-md border bg-white sm:w-[132px]",
    onInk ? "border-paper/25" : "border-line",
  );
  return (
    <ul
      className={cn(
        "m-0 grid list-none grid-cols-3 gap-2 p-0 sm:flex sm:flex-wrap sm:gap-2.5",
        className,
      )}
    >
      {schools.map((school) => {
        const logo = (
          <img
            src={school.logo.full}
            alt={school.school}
            width={1024}
            height={401}
            loading="lazy"
            className="m-0 block h-full w-full object-contain"
          />
        );
        return (
          <li key={school.id} className="m-0 p-0">
            {school.url ? (
              <a
                href={school.url}
                target="_blank"
                rel="noopener"
                title={`${school.school} (opens their site)`}
                onClick={() => sponsorLinkClicked(school, place)}
                className={cn(
                  tile,
                  "outline-none transition-opacity hover:opacity-85 focus-visible:ring-2 focus-visible:ring-rush",
                )}
              >
                {logo}
              </a>
            ) : (
              <span className={tile}>{logo}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
