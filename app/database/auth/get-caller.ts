/**
 * Who is behind a client: nobody, or an account and its platform role.
 *
 * Reads verified claims only (`getClaims()` checks the access token's
 * signature first), never `getSession()`, which trusts the cookie as is. The
 * role is the token's `user_role` (custom_access_token_hook): DriveRush su or
 * admin only on a password or Google session, otherwise `user`. It is for routing; the
 * database checks roles again on every call.
 */
import type { AppRole, TypedSupabaseClient } from "../types";
import { parseRole } from "./roles";

export type Caller =
  | { signedIn: false; userId: null; role: null }
  | { signedIn: true; userId: string; role: AppRole };

const NO_SESSION: Caller = { signedIn: false, userId: null, role: null };

export async function getCaller(
  supabase: TypedSupabaseClient,
): Promise<Caller> {
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data) return NO_SESSION;
  const sub = data.claims.sub;
  if (typeof sub !== "string" || sub === "") return NO_SESSION;
  return {
    signedIn: true,
    userId: sub,
    role: parseRole(data.claims.user_role),
  };
}
