/**
 * Driving schools that sponsor the Model Town Board.
 *
 * One school is picked per visit and owns every place a school shows in that
 * visit: the learner's car wears its paint, the table's brass plates and one
 * green corner of the board carry its logo, and the loader and the "ready for
 * the real test" card name it. One school everywhere sells better than a mix,
 * and is simpler to count.
 *
 * Adding a school: give it a brand file in `scripts/sponsor-art/` (its own
 * design copied from its real car, or one of our styles; or its designer's
 * art on each car's template, `public/assets/board/sponsors/<car>-template.svg`),
 * run `npm run build:sponsors`, and add an entry here. Check it on
 * `/tools/sponsor?id=<id>` before setting `live`.
 */

import type { BoardCarId } from "~/lib/board/cars";

/** A school's paint for one car, at two sizes (phones that struggle get `lo`). */
export type CarPaint = { hi: string; lo: string };

export type Sponsor = {
  id: string;
  /** The school's full name, as it should be written. */
  school: string;
  /** Its brand colours: `paint` for big areas, `ink` for text on white. */
  colors: { paint: string; ink: string };
  /** Logos with transparent backgrounds. `mono` is white, for brass and board paint. */
  logo: { full: string; mono: string };
  /**
   * The school's paint for each board car it has art for, drawn into that
   * car's wrap template; `base` is the body colour shown while it loads or
   * if it fails.
   */
  livery?: { base: string; cars: Partial<Record<BoardCarId, CarPaint>> };
  /**
   * The school's pictures for the classroom walls (`~/lib/board/room`): a
   * banner (3.2 x 0.6 m, two sizes) and framed posters.
   */
  room?: {
    banner: { hi: string; lo: string };
    posters: { logo: string; lessons: string };
  };
  /** The school's site or WhatsApp link, for "Book lessons". */
  url?: string;
  /** Shown to everyone. A school that is not live only shows with `?sponsor=`. */
  live: boolean;
  /** The paid period, as ISO dates. Outside it the school is not picked. */
  from?: string;
  until?: string;
  /**
   * Learners who sign up with one of these (a whole address, or `@domain`)
   * always see this school. Nothing signs learners up yet.
   */
  emailMatch?: string[];
};

const HELTZ_DIR = "/assets/board/sponsors/heltz";
const paintOf = (dir: string, car: BoardCarId): CarPaint => ({
  // "wrap4" goes with the cars' `?v=4` UVs (see build-sponsor-art).
  hi: `${dir}/${car}-wrap4-hi.webp`,
  lo: `${dir}/${car}-wrap4-lo.webp`,
});

export const SPONSORS: readonly Sponsor[] = [
  {
    id: "heltz",
    school: "Heltz Driving Academy",
    colors: { paint: "#f4a20c", ink: "#1d2fc2" },
    logo: {
      full: `${HELTZ_DIR}/logo.png`,
      mono: `${HELTZ_DIR}/logo-mono.png`,
    },
    // Their own car, copied from a photo of it (scripts/sponsor-art/heltz).
    livery: {
      base: "#f6f6f3",
      cars: {
        saloon: paintOf(HELTZ_DIR, "saloon"),
        hatchback: paintOf(HELTZ_DIR, "hatchback"),
        wagon: paintOf(HELTZ_DIR, "wagon"),
        pickup: paintOf(HELTZ_DIR, "pickup"),
        suv: paintOf(HELTZ_DIR, "suv"),
      },
    },
    room: {
      banner: {
        hi: `${HELTZ_DIR}/banner-hi.webp`,
        lo: `${HELTZ_DIR}/banner-lo.webp`,
      },
      posters: {
        logo: `${HELTZ_DIR}/poster-logo.webp`,
        lessons: `${HELTZ_DIR}/poster-lessons.webp`,
      },
    },
    // Live for everyone since 2026-11-21 (owner's call).
    live: true,
  },
];

/**
 * The school everyone sees when no other is picked: Heltz, the board's only
 * school for now (owner, 2026-11-21).
 */
export const DEFAULT_SPONSOR: string | null = "heltz";

export function sponsorById(id: string | null | undefined): Sponsor | null {
  if (!id) return null;
  return SPONSORS.find((s) => s.id === id) ?? null;
}

/** Whether the school's paid period covers this moment. */
export function inPeriod(sponsor: Sponsor, now: Date): boolean {
  const t = now.getTime();
  if (sponsor.from && t < Date.parse(sponsor.from)) return false;
  if (sponsor.until && t >= Date.parse(sponsor.until)) return false;
  return true;
}

function matchesEmail(sponsor: Sponsor, email: string): boolean {
  const address = email.trim().toLowerCase();
  const domain = address.slice(address.lastIndexOf("@"));
  return (sponsor.emailMatch ?? []).some((rule) => {
    const r = rule.trim().toLowerCase();
    return r.startsWith("@") ? r === domain : r === address;
  });
}

/**
 * The school for this visit, or none.
 *
 * 1. `override` (from `?sponsor=`), whether live or not, so a school can be
 *    shown its own car and promo videos can be recorded;
 * 2. a live school matching the learner's email;
 * 3. a live school drawn by `roll` (0 up to, not including, 1, once a visit);
 * 4. the default school.
 */
export function pickSponsor({
  roll,
  now,
  override,
  email,
  list = SPONSORS,
  fallback = DEFAULT_SPONSOR,
}: {
  roll: number;
  now: Date;
  override?: string | null;
  email?: string | null;
  list?: readonly Sponsor[];
  fallback?: string | null;
}): Sponsor | null {
  if (override) {
    const asked = list.find((s) => s.id === override);
    if (asked) return asked;
  }
  const active = list.filter((s) => s.live && inPeriod(s, now));
  if (email) {
    const matched = active.find((s) => matchesEmail(s, email));
    if (matched) return matched;
  }
  if (active.length) {
    const at = Math.min(
      active.length - 1,
      Math.max(0, Math.floor(roll * active.length)),
    );
    return active[at];
  }
  const fallen = list.find((s) => s.id === fallback);
  return fallen && inPeriod(fallen, now) ? fallen : null;
}

/** Where a school shows, for counting. */
export type SponsorPlace =
  | "car"
  | "room"
  | "plate"
  | "board"
  | "loader"
  | "ready_card"
  | "credit"
  /** Named on screen during the opening turn round the car. */
  | "showcase";
