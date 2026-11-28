/**
 * The signed-in learner's saved progress (`learner_progress`), one row per
 * app store, each `{ json: <the store's saved localStorage value> }`.
 * Row level security limits both calls to the caller's own rows.
 */
import { orThrow, type Result, toResult } from "../result";
import type { Json, ProgressStoreName, TypedSupabaseClient } from "../types";

export type ProgressRow = { store: ProgressStoreName; data: Json };

export async function listMyProgress(
  supabase: TypedSupabaseClient,
): Promise<ProgressRow[]> {
  const rows = orThrow(
    await supabase.from("learner_progress").select("store, data"),
  );
  return rows.map((row) => ({
    store: row.store as ProgressStoreName,
    data: row.data,
  }));
}

export type ProgressUpload = {
  store: ProgressStoreName;
  data: { json: Json };
  version: number;
};

export async function upsertMyProgress(
  supabase: TypedSupabaseClient,
  userId: string,
  rows: ProgressUpload[],
): Promise<Result<null>> {
  if (rows.length === 0) return { data: null, error: null };
  return toResult(
    await supabase.from("learner_progress").upsert(
      rows.map((row) => ({ user_id: userId, ...row })),
      { onConflict: "user_id,store" },
    ),
  );
}
