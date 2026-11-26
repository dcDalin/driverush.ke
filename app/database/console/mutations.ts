/**
 * The console's changes: schools, owners and staff roles. Each is a database
 * function that checks the caller (staff, or su for roles) and returns a
 * Result whose error is a sentence for a toast.
 */
import { toResult } from "../result";
import type {
  AppRole,
  Database,
  SchoolStatus,
  TypedSupabaseClient,
} from "../types";

type Client = TypedSupabaseClient;

/**
 * A school. With an owner's email it is live at once (owner added or
 * invited); with none it starts in `setup`, hidden until handed over.
 */
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

/**
 * Hands a school to its owner: `added` (the account exists and owns it
 * now) or `invited` (they own it on sign-up). A school in `setup` goes live.
 */
export async function handOverSchool(
  supabase: Client,
  schoolId: string,
  email: string,
) {
  return toResult(
    await supabase.rpc("admin_hand_over_school", {
      p_school_id: schoolId,
      p_owner_email: email,
    }),
  );
}

export type LiveryDraftInsert = Pick<
  Database["public"]["Tables"]["school_liveries"]["Insert"],
  | "school_id"
  | "label"
  | "base_color"
  | "rail"
  | "paint"
  | "top_board"
  | "banner"
  | "posters"
  | "marks"
  | "thumbs"
  | "stills"
>;

/**
 * A draft livery whose files are already in school-media. Staff only: row
 * level security refuses anyone else, and the row is always a draft.
 */
export async function createLiveryDraft(
  supabase: Client,
  draft: LiveryDraftInsert,
) {
  return toResult(
    await supabase.from("school_liveries").insert(draft).select("id").single(),
  );
}

/** Deletes a livery that is not live (staff only). Its files stay. */
export async function deleteLivery(supabase: Client, liveryId: string) {
  const result = await supabase
    .from("school_liveries")
    .delete()
    .eq("id", liveryId)
    .neq("status", "live")
    .select("id");
  if (result.error) return toResult(result);
  return result.data.length === 1
    ? toResult({ data: liveryId, error: null })
    : toResult({
        data: null,
        error: { message: "not_found", code: "P0002" },
      });
}
