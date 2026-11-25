/**
 * The board's picture (`board-thumb.tsx`) and its social card show the cars
 * in a driving school's paint, as the game does. The schools pay to be seen,
 * so the site's own picture is shared fairly: one still per sponsoring
 * school (its livery's `stills`, in Supabase Storage), a different school
 * each day, in turn. With none, the plain card (`/og/board.jpg`).
 *
 * The day is the UTC day, so a page drawn on the server and the same page
 * woken up in the browser pick the same school.
 *
 * Stills are taken from `/tools/og?card=board-3d&sponsor=<slug>` by
 * `scripts/build-og-images.mjs` and published with the school's livery
 * (`npm run livery:publish`).
 */
import { catalog, liveSchools, type Sponsor } from "./school-catalog";

const DAY_MS = 86_400_000;
const PLAIN_STILL = "/og/board.jpg";

/** The sponsoring schools with a still, in the list's order. */
export function posterSchools(list: readonly Sponsor[] = catalog()) {
  return liveSchools(list).filter((s) => s.stills.poster);
}

/** The school whose still is shown today, if any. */
export function posterSchool(
  now = Date.now(),
  list: readonly Sponsor[] = catalog(),
): Sponsor | null {
  const schools = posterSchools(list);
  if (schools.length === 0) return null;
  return schools[Math.floor(now / DAY_MS) % schools.length]!;
}

/** The board still for a school, 1200 or 2400 pixels wide. */
export function posterPath(
  school: Sponsor | null,
  width: 1200 | 2400 = 1200,
): string {
  const still =
    width === 2400
      ? (school?.stills.poster2400 ?? school?.stills.poster)
      : school?.stills.poster;
  return still ?? PLAIN_STILL;
}

/** The board's social card for a school. */
export function boardCardPath(school: Sponsor | null): string {
  return school?.stills.og ?? PLAIN_STILL;
}
