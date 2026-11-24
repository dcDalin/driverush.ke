/**
 * Names for the generated database types (`database.types.ts`, written by
 * `npm run db:gen-types` from the local database; never edit it by hand).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "./database.types";

export type { Database };
export type TypedSupabaseClient = SupabaseClient<Database>;

type PublicSchema = Database["public"];
export type Tables<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Row"];
export type Enums<T extends keyof PublicSchema["Enums"]> =
  PublicSchema["Enums"][T];

export type AppRole = Enums<"app_role">;
export type SchoolRole = Enums<"school_role">;
/** `school`: their school's livery and full access. `paid`: plain cars, full access. `free`: sponsors take turns. */
export type Tier = "school" | "paid" | "free";

/**
 * One row of `my_entitlement()`. Declared by hand: generated types mark every
 * column of a table-returning function non-null, but the school columns are
 * null unless the tier is `school`, and `ends_at` is null on `free`.
 */
export type Entitlement = {
  tier: Tier;
  school_id: string | null;
  school_name: string | null;
  sponsor_id: string | null;
  branch_id: string | null;
  ends_at: string | null;
  pending_invites: number;
};
