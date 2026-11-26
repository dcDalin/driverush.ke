/**
 * The board's schools on the server: `board_schools()` read with the
 * publishable key (the same answer for everyone, so no session), kept in
 * memory for a few minutes, and turned into the board's `Sponsor` shape with
 * full media URLs. The root loader hands the list to every page; a cold or
 * failed read gives an empty list (plain cars), never an error page. The
 * same read also gives the public driving-school pages each school's own
 * profile and branches (`loadSchoolProfiles`), which the board does not need.
 */
import { createClient } from "@supabase/supabase-js";

import { getSupabaseServerEnv } from "~/database/env.server";
import { getBoardSchools } from "~/database/schools/board-schools";
import type { Database } from "~/database/types";
import { type PublicSchool, toPublicSchool } from "~/lib/school/public-profile";

import { type Sponsor, toSponsor } from "./school-catalog";

/** How long one read serves every request (the CDN keeps /api/board-schools as long). */
export const CATALOG_TTL_MS = 5 * 60_000;

type Read = {
  list: readonly Sponsor[];
  profiles: ReadonlyMap<string, PublicSchool>;
};
const EMPTY: Read = { list: [], profiles: new Map() };

let cached: ({ at: number } & Read) | null = null;
let pending: Promise<Read> | null = null;

function accountsOn() {
  return Boolean(
    process.env.SUPABASE_URL && process.env.SUPABASE_PUBLISHABLE_KEY,
  );
}

async function read(): Promise<Read> {
  const env = getSupabaseServerEnv();
  const client = createClient<Database>(
    env.SUPABASE_URL,
    env.SUPABASE_PUBLISHABLE_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
  const rows = await getBoardSchools(client);
  return {
    list: rows.map((row) => toSponsor(row, env.SUPABASE_URL)),
    profiles: new Map(
      rows.map((row) => [row.slug, toPublicSchool(row, env.SUPABASE_URL)]),
    ),
  };
}

async function load(now: number): Promise<Read> {
  if (!accountsOn()) return EMPTY;
  if (cached && now - cached.at < CATALOG_TTL_MS) return cached;
  pending ??= read()
    .then((fresh) => {
      cached = { at: Date.now(), ...fresh };
      return fresh;
    })
    .catch((error: unknown) => {
      console.error("board_schools could not be read", error);
      // Keep serving the last good list; with none, no schools.
      return cached ?? EMPTY;
    })
    .finally(() => {
      pending = null;
    });
  return pending;
}

/** The schools, from memory if read in the last few minutes. */
export async function loadBoardSchools(
  now = Date.now(),
): Promise<readonly Sponsor[]> {
  return (await load(now)).list;
}

/**
 * Each active school's public profile and open branches, by slug, from the
 * same read: what the school itself says on DriveRush. Empty without accounts.
 */
export async function loadSchoolProfiles(
  now = Date.now(),
): Promise<ReadonlyMap<string, PublicSchool>> {
  return (await load(now)).profiles;
}

/** For tests: forget the cached list. */
export function forgetBoardSchools() {
  cached = null;
  pending = null;
}
