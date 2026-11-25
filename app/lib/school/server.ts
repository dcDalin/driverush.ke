/**
 * Shared by the school dashboard and the console: the request's Supabase
 * client acting as the signed-in person (row level security applies), who
 * they are, and the cookies to send back. Pages that need it 404 in a build
 * with accounts off.
 */
import type { PostgrestError } from "@supabase/supabase-js";
import { data } from "react-router";

import { getCaller } from "~/lib/supabase/caller.server";
import { createSupabaseServerClient } from "~/lib/supabase/server";

export async function signedInRequest(request: Request) {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_PUBLISHABLE_KEY) {
    throw data("Not found", { status: 404 });
  }
  const { supabase, headers } = createSupabaseServerClient(request);
  // A dashboard holds other people's details: never stored by a cache.
  headers.set("Cache-Control", "private, no-store");
  const caller = await getCaller(supabase);
  return { supabase, headers, caller };
}

const REASONS: Record<string, string> = {
  forbidden: "You cannot do that here.",
  admin_limit: "This school already has 50 admins. Remove one first.",
  already_owner: "That email is the school's owner already.",
  invalid_branches: "Pick at least one branch of this school.",
  school_inactive: "This school is not active, so it cannot add students.",
  branch_inactive: "That branch is closed.",
  not_pending: "That has already been answered or started.",
  not_active: "That student's month is already over.",
  not_open: "That link is no longer open.",
  not_found: "We could not find that.",
  cannot_revoke_user: "Everyone keeps the user role.",
  cannot_revoke_own_su: "You cannot remove your own su role.",
};

/** A plain sentence for a refused database call. */
export function reasonFor(
  error: Pick<PostgrestError, "code" | "message"> | null,
): string {
  if (!error) return "";
  const known = REASONS[error.message];
  if (known) return known;
  if (error.code === "42501") return REASONS.forbidden!;
  if (error.code === "23505") return "That already exists.";
  if (error.code === "23514") return "Check the details and try again.";
  return "Something went wrong. Try again.";
}

export type ActionResult =
  { ok: true; message: string } | { ok: false; message: string };
