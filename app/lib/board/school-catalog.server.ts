/**
 * The board's schools on the server: `board_schools()` read with the
 * publishable key (the same answer for everyone, so no session), kept in
 * memory for a few minutes, and turned into the board's `Sponsor` shape with
 * full media URLs. The root loader hands the list to every page; a cold or
 * failed read gives an empty list (plain cars), never an error page.
 */
import { createClient } from "@supabase/supabase-js";

import { getSupabaseServerEnv } from "~/database/env.server";
import { getBoardSchools } from "~/database/schools/board-schools";
import type { Database } from "~/database/types";

import { type Sponsor, toSponsor } from "./school-catalog";

/** How long one read serves every request (the CDN keeps /api/board-schools as long). */
export const CATALOG_TTL_MS = 5 * 60_000;

let cached: { at: number; list: readonly Sponsor[] } | null = null;
let pending: Promise<readonly Sponsor[]> | null = null;

function accountsOn() {
  return Boolean(
    process.env.SUPABASE_URL && process.env.SUPABASE_PUBLISHABLE_KEY,
  );
}

async function read(): Promise<readonly Sponsor[]> {
  const env = getSupabaseServerEnv();
  const client = createClient<Database>(
    env.SUPABASE_URL,
    env.SUPABASE_PUBLISHABLE_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
  const rows = await getBoardSchools(client);
  return rows.map((row) => toSponsor(row, env.SUPABASE_URL));
}

/** The schools, from memory if read in the last few minutes. */
export async function loadBoardSchools(
  now = Date.now(),
): Promise<readonly Sponsor[]> {
  if (!accountsOn()) return [];
  if (cached && now - cached.at < CATALOG_TTL_MS) return cached.list;
  pending ??= read()
    .then((list) => {
      cached = { at: Date.now(), list };
      return list;
    })
    .catch((error: unknown) => {
      console.error("board_schools could not be read", error);
      // Keep serving the last good list; with none, no schools.
      return cached?.list ?? [];
    })
    .finally(() => {
      pending = null;
    });
  return pending;
}

/** For tests: forget the cached list. */
export function forgetBoardSchools() {
  cached = null;
  pending = null;
}
