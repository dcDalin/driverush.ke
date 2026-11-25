/** What the signed-in learner gets now (`my_entitlement()`); see `Entitlement`. */
import { orThrow } from "../result";
import type { Entitlement, TypedSupabaseClient } from "../types";

export async function getMyEntitlement(
  supabase: TypedSupabaseClient,
): Promise<Entitlement | null> {
  const rows = orThrow(await supabase.rpc("my_entitlement"));
  return (rows[0] as Entitlement | undefined) ?? null;
}
