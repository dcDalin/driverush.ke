/**
 * Whether an account holds a DriveRush staff role on file, whatever the
 * session. The token carries the role only on a password or Google session
 * (custom_access_token_hook), so staff who came in with an emailed code (a
 * password reset) read as `user`: this is how the app tells them "sign in
 * again" from "you are not staff". It opens nothing; every gate still reads
 * the token. RLS lets an account read its own rows.
 */
import { orThrow } from "../result";
import type { TypedSupabaseClient } from "../types";
import { isStaffRole } from "./roles";

export async function holdsStaffRole(
  supabase: TypedSupabaseClient,
  userId: string,
): Promise<boolean> {
  const rows = orThrow(
    await supabase.from("user_roles").select("role").eq("user_id", userId),
  );
  return rows.some((row) => isStaffRole(row.role));
}
