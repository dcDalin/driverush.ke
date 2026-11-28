/**
 * Names for the generated database types. `database.ts` beside this file is
 * written by `npm run db:gen-types` from the local database; never edit it.
 * Everything the app knows about a row, an enum or a function's arguments
 * comes from there, so a schema change shows up as a type error.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Enums, Json, Tables } from "./database";

export type { Database, Enums, Json, Tables };

export type TypedSupabaseClient = SupabaseClient<Database>;

type PublicSchema = Database["public"];

/** Arguments and result of a database function (`supabase.rpc`). */
export type FunctionArgs<F extends keyof PublicSchema["Functions"]> =
  PublicSchema["Functions"][F]["Args"];
export type FunctionReturns<F extends keyof PublicSchema["Functions"]> =
  PublicSchema["Functions"][F]["Returns"];

export type AppRole = Enums<"app_role">;
export type SchoolRole = Enums<"school_role">;
export type SchoolStatus = Enums<"school_status">;
export type StudentLinkStatus = Enums<"student_link_status">;

/** The progress stores a learner saves (`learner_progress.store` CHECK). */
export type ProgressStoreName =
  "board" | "pelican" | "signs3d" | "streak" | "daily-drive" | "test" | "proud";

/** `school`: their school's livery and full access. `paid`: plain cars, full access. `free`: sponsors take turns. */
export type Tier = "school" | "paid" | "free";

/**
 * One row of `my_entitlement()`. Narrowed by hand: generated types mark
 * every column of a table-returning function non-null, but the school
 * columns are null unless the tier is `school`, and `ends_at` is null on
 * `free`.
 */
export type Entitlement = Omit<
  FunctionReturns<"my_entitlement">[number],
  | "tier"
  | "school_id"
  | "school_name"
  | "school_slug"
  | "branch_id"
  | "ends_at"
  | "pass_ends_at"
> & {
  tier: Tier;
  school_id: string | null;
  school_name: string | null;
  /** The school's slug: its livery in the board's school list. */
  school_slug: string | null;
  branch_id: string | null;
  ends_at: string | null;
  /** When the learner's passes run out; null with no pass running. */
  pass_ends_at: string | null;
};
