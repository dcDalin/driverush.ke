/**
 * Driving schools that sponsor the Model Town Board.
 *
 * One school is picked per visit and owns every place a school shows in that
 * visit: the learner's car wears its paint, the table's brass plates and one
 * green corner of the board carry its logo, and the loader and the "ready for
 * the real test" card name it. One school everywhere sells better than a mix,
 * and is simpler to count.
 *
 * Adding a school: draw its car into the saloon's wrap template
 * (`public/assets/board/sponsors/saloon-template.svg`), put its files in
 * `public/assets/board/sponsors/<id>/`, run `node scripts/build-sponsor-art.mjs`,
 * and add an entry here. Check it on `/tools/sponsor?id=<id>` before setting
 * `live`.
 */

export type Sponsor = {
  id: string;
  /** The school's full name, as it should be written. */
  school: string;
  /** Its brand colours: `paint` for big areas, `ink` for text on white. */
  colors: { paint: string; ink: string };
  /** Logos with transparent backgrounds. `mono` is white, for brass and board paint. */
  logo: { full: string; mono: string };
  /**
   * The car's paint, drawn into the saloon's wrap template. `hi` and `lo` are
   * the same picture at two sizes (phones that struggle get `lo`); `base` is
   * the body colour shown while it loads or if it fails.
   */
  livery?: { hi: string; lo: string; base: string };
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

const HELZ_DIR = "/assets/board/sponsors/helz";

export const SPONSORS: readonly Sponsor[] = [
  {
    id: "helz",
    school: "Helz Driving Academy",
    colors: { paint: "#f39200", ink: "#1d3fbf" },
    logo: { full: `${HELZ_DIR}/logo.png`, mono: `${HELZ_DIR}/logo-mono.png` },
    livery: {
      hi: `${HELZ_DIR}/wrap-1024.webp`,
      lo: `${HELZ_DIR}/wrap-512.webp`,
      base: "#f4f4f1",
    },
    // Not live until the school has agreed and paid: reachable only with
    // ?sponsor=helz, for showing them their car.
    live: false,
  },
];

/** The school everyone sees when no other is picked. None chosen yet. */
export const DEFAULT_SPONSOR: string | null = null;

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
  | "plate"
  | "board"
  | "loader"
  | "ready_card"
  | "credit";
