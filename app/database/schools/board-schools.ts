/**
 * The board's schools: every active school's public profile and live
 * livery, from `board_schools()` (anyone may call it, guests included), and
 * one livery shaped the same way for staff to preview (`?livery=<id>`).
 */
import { type BoardSchool, parseBoardSchools } from "~/schemas/board-schools";

import { orThrow } from "../result";
import type { TypedSupabaseClient } from "../types";

export async function getBoardSchools(
  supabase: TypedSupabaseClient,
): Promise<BoardSchool[]> {
  const data = orThrow(await supabase.rpc("board_schools"));
  return parseBoardSchools(data);
}

/** Staff only: a livery (a draft too) with its school, for a preview. */
export async function getLiveryPreview(
  supabase: TypedSupabaseClient,
  liveryId: string,
): Promise<BoardSchool | null> {
  const data = orThrow(
    await supabase.rpc("admin_livery_draft_get", { p_livery_id: liveryId }),
  );
  return parseBoardSchools([data])[0] ?? null;
}
