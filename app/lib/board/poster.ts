/**
 * The board's picture (`board-thumb.tsx`) and its social card (`/og/board-*`)
 * show the cars in a driving school's paint, as the game does. The schools
 * pay to be seen, so the site's own picture is shared fairly: one still per
 * live school, and a different school each day, in turn.
 *
 * The day is the UTC day, so a page drawn on the server and the same page
 * woken up in the browser pick the same school.
 *
 * Stills are taken from `/tools/og?card=board-3d&sponsor=<id>` by
 * `scripts/build-og-images.mjs` (see the notes there). A new live school
 * needs its stills taken before it is listed here: the test checks that this
 * list is the live schools.
 */
import { SPONSORS } from "./sponsors";

/** The live schools, in the sponsors' own order. */
export const POSTER_SCHOOLS: readonly string[] = SPONSORS.filter(
  (s) => s.live,
).map((s) => s.id);

const DAY_MS = 86_400_000;

/** The school whose still is shown today. */
export function posterSchool(now = Date.now()): string {
  const day = Math.floor(now / DAY_MS);
  return POSTER_SCHOOLS[day % POSTER_SCHOOLS.length];
}

/** The board still for a school, 1200 or 2400 pixels wide. */
export function posterPath(school: string, width: 1200 | 2400 = 1200): string {
  return `/assets/board/poster-${school}${width === 2400 ? "-2400" : ""}.jpg`;
}

/** The board's social card for a school. */
export function boardCardPath(school: string): string {
  return `/og/board-${school}.jpg`;
}
