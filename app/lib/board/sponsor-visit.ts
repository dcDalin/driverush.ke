/**
 * The school sponsoring this visit, picked once per page load in the browser
 * and shared by everything that shows it (car, plates, board, loader, cards).
 *
 * `?sponsor=<id>` on any page picks that school and is kept for the rest of
 * the tab's session, so a link to the lobby still shows the school once the
 * learner presses Start.
 */
import * as React from "react";

import { analytics, getPostHog } from "~/lib/analytics";
import {
  pickSponsor,
  type Sponsor,
  type SponsorPlace,
} from "~/lib/board/sponsors";

const KEY = "driverush:sponsor";

let visit: Sponsor | null | undefined;

function readOverride(): string | null {
  try {
    const asked = new URLSearchParams(window.location.search).get("sponsor");
    if (asked) {
      sessionStorage.setItem(KEY, asked);
      return asked;
    }
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

/** The visit's school. Browser only; on the server it is always none. */
export function visitSponsor(): Sponsor | null {
  if (typeof window === "undefined") return null;
  if (visit === undefined) {
    visit = pickSponsor({
      roll: Math.random(),
      now: new Date(),
      override: readOverride(),
    });
    // Every event after this carries the school, so drives can be counted
    // per school. PostHog keeps registered properties across visits, so a
    // visit with no school clears the last one.
    const ph = getPostHog();
    if (visit) ph?.register({ sponsor: visit.id });
    else ph?.unregister("sponsor");
  }
  return visit;
}

/** The visit's school, after hydration (none on the first paint). */
export function useVisitSponsor(): Sponsor | null {
  const [sponsor, setSponsor] = React.useState<Sponsor | null>(null);
  React.useEffect(() => setSponsor(visitSponsor()), []);
  return sponsor;
}

const shown = new Set<string>();

/** Counts a school as seen in a place, once per place per visit. */
export function sponsorShown(sponsor: Sponsor | null, place: SponsorPlace) {
  if (!sponsor) return;
  const key = `${sponsor.id}:${place}`;
  if (shown.has(key)) return;
  shown.add(key);
  analytics.sponsorShown({ school: sponsor.id, place });
}

export function sponsorLinkClicked(sponsor: Sponsor, place: SponsorPlace) {
  analytics.sponsorLinkClicked({ school: sponsor.id, place });
}
