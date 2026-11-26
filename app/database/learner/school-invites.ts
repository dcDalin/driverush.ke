/**
 * Schools waiting for the signed-in learner to say yes, and the answer.
 * Joining ends any current school's month early (the database does it).
 */
import { orThrow, toResult } from "../result";
import type { TypedSupabaseClient } from "../types";

export type SchoolInvite = { id: string; school: string; branch: string };

export async function listMySchoolInvites(
  supabase: TypedSupabaseClient,
  userId: string,
): Promise<SchoolInvite[]> {
  const rows = orThrow(
    await supabase
      .from("school_student_links")
      .select("id, schools(name), school_branches(name)")
      .eq("user_id", userId)
      .eq("status", "pending")
      // A lapsed invite is not offered (the school can send it again).
      .gt("expires_at", new Date().toISOString())
      .order("added_at"),
  );
  return rows.map((row) => ({
    id: row.id,
    school: row.schools?.name ?? "A school",
    branch: row.school_branches?.name ?? "",
  }));
}

export async function acceptSchoolInvite(
  supabase: TypedSupabaseClient,
  linkId: string,
) {
  return toResult(
    await supabase.rpc("learner_accept_school_link", { p_link_id: linkId }),
  );
}

export async function declineSchoolInvite(
  supabase: TypedSupabaseClient,
  linkId: string,
) {
  return toResult(
    await supabase.rpc("learner_decline_school_link", { p_link_id: linkId }),
  );
}
