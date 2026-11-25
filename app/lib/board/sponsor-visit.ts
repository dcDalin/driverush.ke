/**
 * The school on the board right now, picked in the browser and shared by
 * everything that shows it (car, roof board, plates, board, room, loader,
 * cards).
 *
 * The schools are shuffled so a learner sees them all (owner, 2026-11-22):
 * every new task or level moves to the next live school (`startRound`). A
 * retry of the same task keeps its school. The school a learner saw last is
 * remembered on the device, so the next visit carries on from there.
 *
 * Two things in the address pick a school:
 *   `?school=<id>`   the school to start on, if it is a live one. The play
 *                    page keeps this in step with the school on screen
 *                    (`app/routes/board-play.tsx`), so a reload shows the
 *                    same one. A wrong id is ignored.
 *   `?sponsor=<id>`  holds that school, live or not, for the rest of the
 *                    tab's session, with no shuffling: for showing a school
 *                    its own car, checking one before it goes live, and
 *                    recording promo videos.
 */
import * as React from "react";

import { analytics, getPostHog } from "~/lib/analytics";
import {
  askedSchool,
  pickSponsor,
  sponsorById,
  type Sponsor,
  type SponsorPlace,
} from "~/lib/board/sponsors";

/** A held school (`?sponsor=`), for the tab's session. */
const KEY = "driverush:sponsor";
/** The school this learner saw last, kept on the device. */
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
const inAddress = (name: string) => {
  try {
    return new URLSearchParams(window.location.search).get(name);
  } catch {
    return null;
  }
};

/** The school on the board. `undefined` until one has been picked. */
let current: Sponsor | null | undefined;
/** Held by `?sponsor=`: it never changes. */
let held = false;
/**
 * The school on the board has not had its task yet: it was just picked, or
 * just asked for in the address. The next task to start keeps it.
 */
let waiting = false;
/** How many tasks have started: schools are counted as seen once in each. */
let round = 0;
/** The task that started last. */
let task: { queue: readonly unknown[] | null; pos: number } = {
  queue: null,
  pos: -1,
};

const listeners = new Set<() => void>();
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function show(next: Sponsor | null, { remember }: { remember: boolean }) {
  const changed = current === undefined || current?.id !== next?.id;
  current = next;
  if (next && remember) write("localStorage", LAST_KEY, next.id);
  if (!changed) return;
  // Every event after this carries the school, so drives can be counted per
  // school. PostHog keeps registered properties across visits, so no school
  // clears the last one.
  const ph = getPostHog();
  if (next) ph?.register({ sponsor: next.id });
  else ph?.unregister("sponsor");
  for (const listener of listeners) listener();
}

function heldId(): string | null {
  const asked = inAddress("sponsor");
  if (asked) {
    write("sessionStorage", KEY, asked);
    return asked;
  }
  return read("sessionStorage", KEY);
}

/** The school on the board. Browser only; on the server it is always none. */
export function visitSponsor(): Sponsor | null {
  if (typeof window === "undefined") return null;
  if (current === undefined) {
    const now = new Date();
    // A held school that does not exist (an old link) holds nothing.
    const pinned = sponsorById(heldId());
    held = pinned !== null;
    waiting = true;
    show(
      pinned ??
        askedSchool(inAddress("school"), { now }) ??
        pickSponsor({
          roll: Math.random(),
          now,
          last: read("localStorage", LAST_KEY),
        }),
      // A held school is not a turn: the shuffle carries on from before it.
      { remember: !held },
    );
  }
  return current ?? null;
}

/**
 * The play page has opened with this `?school=` in its address. On a first
 * load the school is picked from it anyway; arriving from another page of
 * the site, a live school asked for here takes over.
 */
export function enterPlay(asked: string | null): void {
  if (typeof window === "undefined") return;
  const had = visitSponsor();
  if (held) return;
  const school = askedSchool(asked, { now: new Date() });
  if (school && school.id !== had?.id) {
    waiting = true;
    show(school, { remember: true });
  }
}

/**
 * A new task or level is starting: the next live school takes the board. The
 * first task after a school was picked or asked for keeps it.
 *
 * `queue` and `pos` say which task it is (the game's list of tasks, and the
 * place in it): told twice about the same task, it does nothing the second
 * time.
 */
export function startRound(queue: readonly unknown[], pos: number): void {
  if (typeof window === "undefined") return;
  if (task.queue === queue && task.pos === pos) return;
  task = { queue, pos };
  const had = visitSponsor();
  round += 1;
  if (waiting) {
    waiting = false;
    return;
  }
  if (held) return;
  show(pickSponsor({ roll: Math.random(), now: new Date(), last: had?.id }), {
    remember: true,
  });
}

/** The school the next task will show, when it is another one. */
export function nextSchool(): Sponsor | null {
  if (typeof window === "undefined" || held || !current) return null;
  const next = pickSponsor({ roll: 0, now: new Date(), last: current.id });
  return next && next.id !== current.id ? next : null;
}

/**
 * What the signed-in learner's entitlement asks of the board
 * (`~/lib/auth/entitlement.ts`): their school's livery, plain cars, or the
 * usual turns. A `?sponsor=` hold in the address still wins (promo videos,
 * checking a school's car).
 */
let ruled = false;
export function applyLiveryRule(
  rule:
    | { kind: "rotate" }
    | { kind: "school"; sponsorId: string }
    | { kind: "plain" },
): void {
  if (typeof window === "undefined") return;
  visitSponsor();
  if (sponsorById(heldId())) return;
  if (rule.kind === "rotate") {
    if (!ruled) return;
    ruled = false;
    held = false;
    show(
      pickSponsor({
        roll: Math.random(),
        now: new Date(),
        last: read("localStorage", LAST_KEY),
      }),
      {
        remember: true,
      },
    );
    return;
  }
  ruled = true;
  held = true;
  // A school's own learners see its livery even outside its paid period.
  show(rule.kind === "school" ? sponsorById(rule.sponsorId) : null, {
    remember: false,
  });
}

/** A school is held by `?sponsor=`: the address is not ours to write. */
export function schoolHeld(): boolean {
  // A school held by the learner's entitlement (their own school) is shown
  // in the address like any other; only `?sponsor=` keeps it as given.
  return held && !ruled;
}

const none = () => null;
const snapshot = () => current ?? null;

/** The school on the board, after hydration (none on the first paint). */
export function useVisitSponsor(): Sponsor | null {
  const sponsor = React.useSyncExternalStore(subscribe, snapshot, none);
  // Picked after the first paint, never during a render.
  React.useEffect(() => {
    visitSponsor();
  }, []);
  return sponsor;
}

const shown = new Set<string>();

/** Counts a school as seen in a place, once per place per task. */
export function sponsorShown(sponsor: Sponsor | null, place: SponsorPlace) {
  if (!sponsor) return;
  const key = `${round}:${sponsor.id}:${place}`;
  if (shown.has(key)) return;
  shown.add(key);
  analytics.sponsorShown({ school: sponsor.id, place });
}

export function sponsorLinkClicked(sponsor: Sponsor, place: SponsorPlace) {
  analytics.sponsorLinkClicked({ school: sponsor.id, place });
}
