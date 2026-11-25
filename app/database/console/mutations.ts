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
    ownerEmail: string;
  },
) {
  return toResult(
    await supabase.rpc("admin_create_school", {
      p_name: school.name,
      p_slug: school.slug,
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

/** Makes a livery the school's live one (the one before is retired). */
export async function publishLivery(supabase: Client, liveryId: string) {
  return toResult(
    await supabase.rpc("admin_publish_livery", { p_livery_id: liveryId }),
  );
}

/** Takes a livery off the board: the school shows plain cars. */
export async function retireLivery(supabase: Client, liveryId: string) {
  return toResult(
    await supabase.rpc("admin_retire_livery", { p_livery_id: liveryId }),
  );
}

/** A sponsorship from `startsOn` (Kenyan days), open-ended without `endsOn`. */
export async function setSponsorship(
  supabase: Client,
  sponsorship: {
    schoolId: string;
    startsOn: string;
    endsOn: string;
    note: string;
  },
) {
  return toResult(
    await supabase.rpc("admin_set_sponsorship", {
      p_school_id: sponsorship.schoolId,
      p_starts_on: sponsorship.startsOn,
      // An open-ended sponsorship: the function takes a null end.
      p_ends_on: (sponsorship.endsOn || null) as string,
      p_note: sponsorship.note,
    }),
  );
}

/** Ends a sponsorship today (Kenyan date). */
export async function endSponsorship(supabase: Client, sponsorshipId: string) {
  return toResult(
    await supabase.rpc("admin_end_sponsorship", {
      p_sponsorship_id: sponsorshipId,
    }),
  );
}
