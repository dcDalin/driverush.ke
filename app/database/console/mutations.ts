/**
 * The console's changes: schools, owners and staff roles. Each is a database
 * function that checks the caller (staff, or su for roles) and returns a
 * Result whose error is a sentence for a toast.
 */
import { toResult } from "../result";
import type { AppRole, SchoolStatus, TypedSupabaseClient } from "../types";

type Client = TypedSupabaseClient;

export async function createSchool(
  supabase: Client,
  school: {
    name: string;
    slug: string;
    sponsorId: string | null;
    ownerEmail: string;
  },
) {
  return toResult(
    await supabase.rpc("admin_create_school", {
      p_name: school.name,
      p_slug: school.slug,
      p_sponsor_id: school.sponsorId ?? "",
      p_owner_email: school.ownerEmail,
    }),
  );
}

export async function setSchoolStatus(
  supabase: Client,
  schoolId: string,
  status: SchoolStatus,
) {
  return toResult(
    await supabase.rpc("admin_set_school_status", {
      p_school_id: schoolId,
      p_status: status,
    }),
  );
}

/** `added` (the account exists and now owns it) or `invited`. */
export async function transferSchoolOwner(
  supabase: Client,
  schoolId: string,
  email: string,
) {
  return toResult(
    await supabase.rpc("admin_transfer_school_owner", {
      p_school_id: schoolId,
      p_email: email,
    }),
  );
}

export async function grantPlatformRole(
  supabase: Client,
  userId: string,
  role: AppRole,
) {
  return toResult(
    await supabase.rpc("grant_platform_role", {
      p_user_id: userId,
      p_role: role,
    }),
  );
}

export async function revokePlatformRole(
  supabase: Client,
  userId: string,
  role: AppRole,
) {
  return toResult(
    await supabase.rpc("revoke_platform_role", {
      p_user_id: userId,
      p_role: role,
    }),
  );
}
