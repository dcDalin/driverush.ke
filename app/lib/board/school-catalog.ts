/**
 * The driving schools on the board, as data from Supabase instead of code.
 *
 * One school at a time owns every place a school shows: the learner's car
 * wears its paint and roof board, the table's brass plates and one green
 * corner of the board carry its marks, the classroom's walls its pictures,
 * and the loader and the "ready for the real test" card name it. The schools
 * that sponsor the board take turns (`~/lib/board/sponsor-visit`); a school
 * learner always sees their own school.
 *
 * Where it comes from: `board_schools()` returns each active school's
 * profile and live livery as school-media paths. The server reads it once
 * every few minutes (`school-catalog.server.ts`) and hands it to the page in
 * the root loader, already turned into URLs (`toSponsor`); the root primes
 * this store before anything renders, so pages drawn on the server and woken
 * in the browser see the same schools. Without Supabase the list is empty:
 * plain cars, no credits.
 *
 * Adding or changing a school's look: `scripts/sponsor-art` (the art), then
 * `npm run livery:publish <slug>` and Publish in the console
 * (docs/school-media.md). No commit, no deploy.
 */
import * as React from "react";

import type { BoardSchool } from "~/schemas/board-schools";

import type { BoardCarId } from "./cars";

/** A school's paint for one car, at two sizes (phones that struggle get `lo`). */
export type CarPaint = { hi: string; lo: string };

/**
 * The name board on the roof of a school's car (`top-board.ts`): its picture,
 * its size in metres, how much of each corner is cut off, and its edge colour.
 */
export type TopBoard = {
  src: string;
  width: number;
  height: number;
  cut: number;
  edge: string;
};

export type Sponsor = {
  /** The school's slug: `?school=`, `?sponsor=`, PostHog's `school`. */
  id: string;
  /** The school's full name, as it should be written. */
  school: string;
  /** Its brand colours: `paint` for big areas, `ink` for text on white. */
  colors: { paint: string; ink: string };
  /** Logos with transparent backgrounds. `mono` is white, for brass and board paint. */
  logo: { full: string; mono: string };
  /** The school's paint per board car; `base` is the body colour while it loads. */
  livery?: { base: string; cars: Partial<Record<BoardCarId, CarPaint>> };
  /** The name board on the learner's car's roof. */
  topBoard?: TopBoard;
  /** The classroom's banner, posters and stripe rail (`~/lib/board/room`). */
  room?: {
    banner: { hi: string; lo: string };
    posters: { logo: string; lessons: string };
    rail: { gold: string; red: string };
  };
  /** Car menu pictures in the school's paint. */
  thumbs: Partial<Record<BoardCarId, string>>;
  /** The board's still pictures and social card in the school's paint. */
  stills: { poster?: string; poster2400?: string; og?: string };
  /** The school's site, for "Book lessons". */
  url?: string;
  /** Sponsoring now: its cars take turns for guests and free learners. */
  live: boolean;
  /** The livery's id (for counting and previews). */
  liveryId?: string;
};

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

/** The public URL of a school-media path (`<supabase>/storage/v1/object/public/school-media/<path>`). */
export function mediaUrl(base: string, path: string): string {
  return `${base.replace(/\/$/, "")}/storage/v1/object/public/school-media/${path}`;
}

const FALLBACK_COLORS = { paint: "#1f2937", ink: "#111827" };

/**
 * A `board_schools()` row as the board uses it, with every path made a URL.
 * A school without a live livery still has its name, colours and logo (its
 * learners see plain cars).
 */
export function toSponsor(row: BoardSchool, base: string): Sponsor {
  const url = (path: string) => mediaUrl(base, path);
  const livery = row.livery;
  const profile = row.profile;
  const fullLogo = profile?.logo?.path ?? livery?.marks.full;
  const monoLogo = livery?.marks.mono ?? profile?.logo_mono?.path ?? fullLogo;
  const cars = livery
    ? (Object.fromEntries(
        Object.entries(livery.paint).map(([car, p]) => [
          car,
          { hi: url(p.hi), lo: url(p.lo) },
        ]),
      ) as Partial<Record<BoardCarId, CarPaint>>)
    : undefined;
  return {
    id: row.slug,
    school: row.name,
    colors: {
      paint:
        profile?.brand_paint ?? livery?.base_color ?? FALLBACK_COLORS.paint,
      ink: profile?.brand_ink ?? FALLBACK_COLORS.ink,
    },
    logo: {
      full: fullLogo ? url(fullLogo) : "",
      mono: monoLogo ? url(monoLogo) : "",
    },
    livery: livery && cars ? { base: livery.base_color, cars } : undefined,
    topBoard: livery?.top_board
      ? {
          src: url(livery.top_board.path),
          width: livery.top_board.metres.width,
          height: livery.top_board.metres.height,
          cut: livery.top_board.cut,
          edge: livery.top_board.edge,
        }
      : undefined,
    room:
      livery?.banner && livery.posters
        ? {
            banner: { hi: url(livery.banner.hi), lo: url(livery.banner.lo) },
            posters: {
              logo: url(livery.posters.logo),
              lessons: url(livery.posters.lessons),
            },
            rail: livery.rail,
          }
        : undefined,
    thumbs: livery
      ? (Object.fromEntries(
          Object.entries(livery.thumbs).map(([car, p]) => [car, url(p)]),
        ) as Partial<Record<BoardCarId, string>>)
      : {},
    stills: {
      poster: livery?.stills.poster ? url(livery.stills.poster) : undefined,
      poster2400: livery?.stills.poster_2400
        ? url(livery.stills.poster_2400)
        : undefined,
      og: livery?.stills.og ? url(livery.stills.og) : undefined,
    },
    url: profile?.website_url ?? undefined,
    live: row.sponsoring && livery !== null,
    liveryId: livery?.id,
  };
}

// ── The store ─────────────────────────────────────────────────────────────

let schools: readonly Sponsor[] = [];
/** Shown on top of the list for this tab only (a staff preview). */
let preview: Sponsor | null = null;
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

/**
 * Sets the schools. The root calls it with its loader data during render,
 * before any child reads the list, so it tells no one (a store must not
 * update other components mid-render); the background refresh calls it with
 * `{ announce: true }`. Calling it again with the same list is free.
 */
export function primeCatalog(
  list: readonly Sponsor[],
  { announce = false }: { announce?: boolean } = {},
) {
  if (list === schools) return;
  schools = list;
  if (announce) notify();
}

/** A staff preview of a draft livery, in this tab only. */
export function previewSchool(sponsor: Sponsor | null) {
  preview = sponsor;
  notify();
}

/** Every school (with the staff preview first, if one is set). */
export function catalog(): readonly Sponsor[] {
  if (!preview) return schools;
  return [preview, ...schools.filter((s) => s.id !== preview!.id)];
}

let snapshot = catalog();
function readSnapshot() {
  const next = catalog();
  if (
    next.length !== snapshot.length ||
    next.some((s, i) => s !== snapshot[i])
  ) {
    snapshot = next;
  }
  return snapshot;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The schools, re-rendering when the list changes. */
export function useCatalog(): readonly Sponsor[] {
  return React.useSyncExternalStore(subscribe, readSnapshot, readSnapshot);
}

/** The schools sponsoring now (their cars take turns), in the list's order. */
export function liveSchools(list: readonly Sponsor[] = catalog()) {
  return list.filter((s) => s.live);
}

// ── Picking a school ──────────────────────────────────────────────────────

export function sponsorById(
  id: string | null | undefined,
  list: readonly Sponsor[] = catalog(),
): Sponsor | null {
  if (!id) return null;
  return list.find((s) => s.id === id) ?? null;
}

/**
 * The school asked for by `?school=<slug>` in the address, if it is one a
 * learner may be shown: sponsoring now. Anything else (a typo, a school that
 * has left) is nothing, and the shuffle carries on.
 */
export function askedSchool(
  id: string | null | undefined,
  { list = catalog() }: { list?: readonly Sponsor[] } = {},
): Sponsor | null {
  if (!id) return null;
  const school = list.find((s) => s.id === id);
  return school?.live ? school : null;
}

/**
 * The school for this visit, or none.
 *
 * 1. `override` (from `?sponsor=`), sponsoring or not, so a school can be
 *    shown its own car and promo videos can be recorded;
 * 2. the sponsoring schools take turns (owner, 2026-11-21; every task since
 *    2026-11-22): after the school a learner saw last (`last`) comes the next
 *    in the list, so everyone sees every school; with none seen yet, one is
 *    drawn by `roll` (0 up to, not including, 1).
 */
export function pickSponsor({
  roll,
  override,
  last,
  list = catalog(),
}: {
  roll: number;
  override?: string | null;
  /** The school this learner saw last, if any. */
  last?: string | null;
  list?: readonly Sponsor[];
}): Sponsor | null {
  if (override) {
    const asked = list.find((s) => s.id === override);
    if (asked) return asked;
  }
  const active = liveSchools(list);
  if (!active.length) return null;
  const before = last ? active.findIndex((s) => s.id === last) : -1;
  if (before >= 0) return active[(before + 1) % active.length]!;
  const at = Math.min(
    active.length - 1,
    Math.max(0, Math.floor(roll * active.length)),
  );
  return active[at]!;
}

// ── Keeping it fresh ──────────────────────────────────────────────────────

/** A page older than this asks /api/board-schools for the current list. */
const STALE_MS = 10 * 60_000;

/**
 * Refreshes the list in the background when the page's copy is old (the
 * installed app keeps pages for days): one GET, cached by the CDN and the
 * service worker. Failing quietly keeps the list the page came with.
 */
export function useCatalogRefresh(loadedAt: number | null) {
  React.useEffect(() => {
    if (loadedAt === null || Date.now() - loadedAt < STALE_MS) return;
    const controller = new AbortController();
    fetch("/api/board-schools", { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((body: { schools?: Sponsor[] } | null) => {
        if (body?.schools) primeCatalog(body.schools, { announce: true });
      })
      .catch(() => {});
    return () => controller.abort();
  }, [loadedAt]);
}
