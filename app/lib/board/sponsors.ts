/**
 * Driving schools that sponsor the Model Town Board.
 *
 * One school at a time owns every place a school shows: the learner's car
 * wears its paint and roof board, the table's brass plates and one green
 * corner of the board carry its logo, the classroom's walls its pictures, and
 * the loader and the "ready for the real test" card name it. One school
 * everywhere sells better than a mix, and is simpler to count. The schools
 * are shuffled: each new task or level shows the next live one
 * (`~/lib/board/sponsor-visit`).
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

/**
 * The name board on the roof of a school's car (`top-board.ts`): its picture,
 * its size in metres (about a third bigger than a real one, so the name
 * reads), how much of each corner is cut off, and its edge's colour.
 */
export type TopBoard = {
  src: string;
  width: number;
  height: number;
  cut: number;
  edge: string;
};

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
  /** The name board on the learner's car's roof. */
  topBoard?: TopBoard;
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
const TOPGEAR_DIR = "/assets/board/sponsors/topgear";
const BLIXEN_DIR = "/assets/board/sponsors/blixen";
const AA_DIR = "/assets/board/sponsors/aa";
const PETANNS_DIR = "/assets/board/sponsors/petanns";
const ALL_CARS: readonly BoardCarId[] = [
  "saloon",
  "hatchback",
  "wagon",
  "pickup",
  "suv",
  "van",
  "lorry",
  "crossover",
];
/** A school with paint for every board car. */
const everyCar = (dir: string) =>
  Object.fromEntries(ALL_CARS.map((car) => [car, paintOf(dir, car)])) as Record<
    BoardCarId,
    CarPaint
  >;
/**
 * "wrap4" goes with the cars' `?v=4` UVs (see build-sponsor-art). `PAINT_V`
 * is the paint's own version: bump it when the schools' paint is redrawn on
 * the same UVs, so a phone that has the old pictures fetches the new ones at
 * once instead of on its next visit (public/sw.js refreshes them behind).
 * 2: every livery fitted per vehicle (cars, van, lorry), 2026-11-22.
 */
const PAINT_V = 2;
const paintOf = (dir: string, car: BoardCarId): CarPaint => ({
  hi: `${dir}/${car}-wrap4-hi.webp?v=${PAINT_V}`,
  lo: `${dir}/${car}-wrap4-lo.webp?v=${PAINT_V}`,
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
      cars: everyCar(HELTZ_DIR),
    },
    // Their real car has no roof board: every school's board car carries one
    // (owner, 2026-11-21), so this one is ours, in their look.
    topBoard: {
      src: `${HELTZ_DIR}/topboard.webp`,
      width: 1.35,
      height: 0.45,
      cut: 0.04,
      edge: "#e3271b",
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
    // Their own site (Tom Mboya Street head office), checked 2026-11-24.
    url: "https://heltzdrivingschool.com",
    // Live for everyone since 2026-11-21 (owner's call).
    live: true,
  },
  {
    id: "topgear",
    school: "Top Gear Driving School",
    colors: { paint: "#c2201c", ink: "#1b34c8" },
    logo: {
      full: `${TOPGEAR_DIR}/logo.png`,
      mono: `${TOPGEAR_DIR}/logo-mono.png`,
    },
    // Their own red car, copied from photos of it (scripts/sponsor-art/topgear).
    livery: { base: "#c2201c", cars: everyCar(TOPGEAR_DIR) },
    // As on their car: yellow, corners cut, a red edge.
    topBoard: {
      src: `${TOPGEAR_DIR}/topboard.webp`,
      width: 1.35,
      height: 0.45,
      cut: 0.13,
      edge: "#d81f1c",
    },
    room: {
      banner: {
        hi: `${TOPGEAR_DIR}/banner-hi.webp`,
        lo: `${TOPGEAR_DIR}/banner-lo.webp`,
      },
      posters: {
        logo: `${TOPGEAR_DIR}/poster-logo.webp`,
        lessons: `${TOPGEAR_DIR}/poster-lessons.webp`,
      },
    },
    // Their own site (Outer Ring Road, Tena; 0722 784 235), checked 2026-11-24.
    url: "https://topgeardrivingschool.co.ke",
    // Live since 2026-11-22: the owner approved its pictures. It takes turns
    // with the other live schools (`pickSponsor`).
    live: true,
  },
  {
    id: "blixen",
    school: "Blixen Auto Driving School",
    colors: { paint: "#f05a23", ink: "#1f2646" },
    logo: {
      full: `${BLIXEN_DIR}/logo.png`,
      mono: `${BLIXEN_DIR}/logo-mono.png`,
    },
    // Their own silver and orange car, copied from photos of it
    // (scripts/sponsor-art/blixen).
    livery: { base: "#c9ccd1", cars: everyCar(BLIXEN_DIR) },
    // As on their car: white, B.A.D.S in red with the L, a thin dark frame.
    topBoard: {
      src: `${BLIXEN_DIR}/topboard.webp`,
      width: 1.35,
      height: 0.45,
      cut: 0.02,
      edge: "#3a3b3f",
    },
    room: {
      banner: {
        hi: `${BLIXEN_DIR}/banner-hi.webp`,
        lo: `${BLIXEN_DIR}/banner-lo.webp`,
      },
      posters: {
        logo: `${BLIXEN_DIR}/poster-logo.webp`,
        lessons: `${BLIXEN_DIR}/poster-lessons.webp`,
      },
    },
    // Their own site, as lettered on their cars (owner, 2026-11-22).
    url: "https://www.bads.co.ke",
    // Live since 2026-11-22: the owner approved its pictures.
    live: true,
  },
  {
    id: "aa",
    school: "AA Driving School",
    colors: { paint: "#fbd91f", ink: "#046240" },
    logo: {
      full: `${AA_DIR}/logo.png`,
      mono: `${AA_DIR}/logo-mono.png`,
    },
    // Their own dark green car with its yellow squares, copied from photos
    // of it (scripts/sponsor-art/aa).
    livery: { base: "#0d3b2a", cars: everyCar(AA_DIR) },
    // As on their saloons: yellow in a black frame, the L, a black band.
    topBoard: {
      src: `${AA_DIR}/topboard.webp`,
      width: 1.35,
      height: 0.45,
      cut: 0.02,
      edge: "#141414",
    },
    room: {
      banner: {
        hi: `${AA_DIR}/banner-hi.webp`,
        lo: `${AA_DIR}/banner-lo.webp`,
      },
      posters: {
        logo: `${AA_DIR}/poster-logo.webp`,
        lessons: `${AA_DIR}/poster-lessons.webp`,
      },
    },
    // AA Kenya's own site, as on their adverts.
    url: "https://www.aakenya.co.ke",
    // Live since 2026-11-22: the owner approved its pictures.
    live: true,
  },
  {
    id: "petanns",
    school: "Petanns Driving School",
    colors: { paint: "#1568f0", ink: "#1b3f95" },
    logo: {
      full: `${PETANNS_DIR}/logo.png`,
      mono: `${PETANNS_DIR}/logo-mono.png`,
    },
    // Their own white, blue and orange car, copied from photos of it
    // (scripts/sponsor-art/petanns).
    livery: { base: "#f8f8f5", cars: everyCar(PETANNS_DIR) },
    // Their real cars carry no roof board: this one is ours, in their look.
    topBoard: {
      src: `${PETANNS_DIR}/topboard.webp`,
      width: 1.35,
      height: 0.45,
      cut: 0.04,
      edge: "#f4421a",
    },
    room: {
      banner: {
        hi: `${PETANNS_DIR}/banner-hi.webp`,
        lo: `${PETANNS_DIR}/banner-lo.webp`,
      },
      posters: {
        logo: `${PETANNS_DIR}/poster-logo.webp`,
        lessons: `${PETANNS_DIR}/poster-lessons.webp`,
      },
    },
    // Their own site; its WhatsApp is the 0705 05 05 04 on their cars.
    // Checked 2026-11-24.
    url: "https://petannsdrivingschool.co.ke",
    // Live since 2026-11-22: the owner approved its pictures.
    live: true,
  },
];

/**
 * The school shown when no live school can be picked, and on the site's still
 * pictures: Heltz, the board's first school (owner, 2026-11-21).
 */
export const DEFAULT_SPONSOR: string | null = "heltz";

export function sponsorById(id: string | null | undefined): Sponsor | null {
  if (!id) return null;
  return SPONSORS.find((s) => s.id === id) ?? null;
}

/**
 * The school asked for by `?school=<id>` in the address, if it is one a
 * learner may be shown: live, and inside its paid period. Anything else (a
 * typo, a school that has left or is not live yet) is nothing, and the
 * shuffle carries on.
 */
export function askedSchool(
  id: string | null | undefined,
  { now, list = SPONSORS }: { now: Date; list?: readonly Sponsor[] },
): Sponsor | null {
  if (!id) return null;
  const school = list.find((s) => s.id === id);
  return school && school.live && inPeriod(school, now) ? school : null;
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
 * 3. the live schools take turns (owner, 2026-11-21; every task since
 *    2026-11-22): after the school a learner saw last (`last`) comes the next
 *    in the list, so everyone sees every school; with none seen yet, one is
 *    drawn by `roll` (0 up to, not including, 1);
 * 4. the default school.
 */
export function pickSponsor({
  roll,
  now,
  override,
  email,
  last,
  list = SPONSORS,
  fallback = DEFAULT_SPONSOR,
}: {
  roll: number;
  now: Date;
  override?: string | null;
  email?: string | null;
  /** The school this learner saw last, if any. */
  last?: string | null;
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
    const before = last ? active.findIndex((s) => s.id === last) : -1;
    if (before >= 0) return active[(before + 1) % active.length]!;
    const at = Math.min(
      active.length - 1,
      Math.max(0, Math.floor(roll * active.length)),
    );
    return active[at]!;
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
  | "showcase"
  /** The site footer's row of schools on the board. */
  | "footer"
  /** The About page's section on the schools. */
  | "about"
  /** The driving schools guide's section on the schools. */
  | "guide"
  /** The board page's section on the schools (`/model-town-board`). */
  | "board_page"
  /** The home page's row of schools. */
  | "home";
