/**
 * The school sponsoring this visit, picked once per visit in the browser and
 * shared by everything that shows it (car, plates, board, loader, cards).
 *
 * A visit is a tab's session: a reload keeps the same school, so the car does
 * not change paint mid-visit. The schools take turns from one visit to the
 * next (`pickSponsor`), remembered on the device.
 *
 * `?sponsor=<id>` on any page picks that school and is kept for the rest of
 * the tab's session, so a link to the lobby still shows the school once the
 * learner presses Start. It does not count as a turn.
 */
import * as React from "react";

import { analytics, getPostHog } from "~/lib/analytics";
import {
  pickSponsor,
  type Sponsor,
  type SponsorPlace,
} from "~/lib/board/sponsors";

const KEY = "driverush:sponsor";
/** This visit's school (session), and the last visit's (kept on the device). */
const VISIT_KEY = "driverush:sponsor-visit";
const LAST_KEY = "driverush:sponsor-last";

function read(store: "sessionStorage" | "localStorage", key: string) {
  try {
    return window[store].getItem(key);
  } catch {
    return null;
  }
}
function write(
  store: "sessionStorage" | "localStorage",
  key: string,
  value: string,
) {
  try {
    window[store].setItem(key, value);
  } catch {
    // Private windows: the school is still picked, only not remembered.
  }
}

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
    const override = readOverride();
    // The same school for the whole visit; the next one on the next visit.
    const sameVisit = read("sessionStorage", VISIT_KEY);
    visit = pickSponsor({
      roll: Math.random(),
      now: new Date(),
      override: override ?? sameVisit,
      last: read("localStorage", LAST_KEY),
    });
    if (visit && !override) {
      write("sessionStorage", VISIT_KEY, visit.id);
      write("localStorage", LAST_KEY, visit.id);
    }
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
