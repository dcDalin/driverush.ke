/**
 * Reads for a school's dashboard. Each runs as the signed-in person, so row
 * level security decides the rows: an owner sees the whole school, a branch
 * admin only their branches, staff everything. Reads throw.
 */
import { orThrow } from "../result";
import type { FunctionReturns, TypedSupabaseClient } from "../types";

export async function listMySchools(
  supabase: TypedSupabaseClient,
  userId: string,
) {
  const rows = orThrow(
    await supabase
      .from("school_members")
      .select("role, schools(id, name, status)")
      .eq("user_id", userId),
  );
  return rows
    .flatMap((row) => (row.schools ? [{ role: row.role, ...row.schools }] : []))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** The caller's role in a school (owner or admin), or null. */
export async function getMySchoolRole(
  supabase: TypedSupabaseClient,
  schoolId: string,
  userId: string,
) {
  const row = orThrow(
    await supabase
      .from("school_members")
      .select("role")
      .eq("school_id", schoolId)
      .eq("user_id", userId)
      .maybeSingle(),
  );
  return row?.role ?? null;
}

export async function getSchool(
  supabase: TypedSupabaseClient,
  schoolId: string,
) {
  return orThrow(
    await supabase
      .from("schools")
      .select("id, name, status, slug")
      .eq("id", schoolId)
      .maybeSingle(),
  );
}

export async function listBranches(
  supabase: TypedSupabaseClient,
  schoolId: string,
) {
  return orThrow(
    await supabase
      .from("school_branches")
      .select("id, name, town, is_active, address, lat, lng, phone, hours")
      .eq("school_id", schoolId)
      .order("name"),
  );
}

export type SchoolMember = FunctionReturns<"school_members_list">[number];

export async function listSchoolMembers(
  supabase: TypedSupabaseClient,
  schoolId: string,
): Promise<SchoolMember[]> {
  return orThrow(
    await supabase.rpc("school_members_list", { p_school_id: schoolId }),
  );
}

export async function listPendingMemberInvites(
  supabase: TypedSupabaseClient,
  schoolId: string,
) {
  return orThrow(
    await supabase
      .from("school_member_invites")
      .select("id, email, role, branch_ids, created_at")
      .eq("school_id", schoolId)
      .eq("status", "pending")
      .order("created_at"),
  );
}

/** One pending admin or owner invite (owner and staff read them). */
export async function getMemberInvite(
  supabase: TypedSupabaseClient,
  inviteId: string,
) {
  return orThrow(
    await supabase
      .from("school_member_invites")
      .select("id, school_id, email, role, branch_ids, status")
      .eq("id", inviteId)
      .maybeSingle(),
  );
}

/** One student link, if the caller's branches include it. */
export async function getStudentLink(
  supabase: TypedSupabaseClient,
  linkId: string,
) {
  return orThrow(
    await supabase
      .from("school_student_links")
      .select("id, school_id, email, status, branch_id, school_branches(name)")
      .eq("id", linkId)
      .maybeSingle(),
  );
}

/** Links not yet over: waiting (pending) or running (active). */
export async function listOpenStudentLinks(
  supabase: TypedSupabaseClient,
  schoolId: string,
) {
  return orThrow(
    await supabase
      .from("school_student_links")
      .select("id, email, status, branch_id, starts_at, ends_at, added_at")
      .eq("school_id", schoolId)
      .in("status", ["pending", "active"])
      .order("added_at", { ascending: false })
      .limit(1000),
  );
}

export type StudentProgressRow =
  FunctionReturns<"school_student_progress">[number];

export async function listStudentProgress(
  supabase: TypedSupabaseClient,
  schoolId: string,
): Promise<StudentProgressRow[]> {
  return orThrow(
    await supabase.rpc("school_student_progress", { p_school_id: schoolId }),
  );
}

/** The school's profile (owner, admins and staff read it), or null before its first edit. */
export async function getSchoolProfile(
  supabase: TypedSupabaseClient,
  schoolId: string,
) {
  return orThrow(
    await supabase
      .from("school_profiles")
      .select(
        "tagline, about, phone, whatsapp, email, website_url, socials, brand_paint, brand_ink, logo, logo_mono, updated_at",
      )
      .eq("school_id", schoolId)
      .maybeSingle(),
  );
}
