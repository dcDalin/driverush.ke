/**
 * A school's changes, each one database function called as the signed-in
 * person (its guard decides: owner, branch admin or staff). Each returns a
 * Result whose error is a sentence for a toast.
 */
import { toResult } from "../result";
import type { TypedSupabaseClient } from "../types";

type Client = TypedSupabaseClient;

/** Returns the link id. */
export async function addStudent(
  supabase: Client,
  branchId: string,
  email: string,
) {
  return toResult(
    await supabase.rpc("school_add_student", {
      p_branch_id: branchId,
      p_email: email,
    }),
  );
}

export async function releaseStudent(supabase: Client, linkId: string) {
  return toResult(
    await supabase.rpc("school_release_student", { p_link_id: linkId }),
  );
}

export async function cancelStudentInvite(supabase: Client, linkId: string) {
  return toResult(
    await supabase.rpc("school_cancel_student_invite", { p_link_id: linkId }),
  );
}

export async function moveStudent(
  supabase: Client,
  linkId: string,
  branchId: string,
) {
  return toResult(
    await supabase.rpc("school_move_student_branch", {
      p_link_id: linkId,
      p_branch_id: branchId,
    }),
  );
}

/** `added` when the email has an account, `invited` when it waits for sign-up. */
export async function addAdmin(
  supabase: Client,
  schoolId: string,
  email: string,
  branchIds: string[],
) {
  return toResult(
    await supabase.rpc("school_add_admin", {
      p_school_id: schoolId,
      p_email: email,
      p_branch_ids: branchIds,
    }),
  );
}

export async function setAdminBranches(
  supabase: Client,
  memberId: string,
  branchIds: string[],
) {
  return toResult(
    await supabase.rpc("school_set_admin_branches", {
      p_member_id: memberId,
      p_branch_ids: branchIds,
    }),
  );
}

export async function removeAdmin(supabase: Client, memberId: string) {
  return toResult(
    await supabase.rpc("school_remove_admin", { p_member_id: memberId }),
  );
}

export async function cancelMemberInvite(supabase: Client, inviteId: string) {
  return toResult(
    await supabase.rpc("school_cancel_member_invite", {
      p_invite_id: inviteId,
    }),
  );
}

export async function createBranch(
  supabase: Client,
  schoolId: string,
  name: string,
  town: string,
) {
  return toResult(
    await supabase.rpc("school_create_branch", {
      p_school_id: schoolId,
      p_name: name,
      p_town: town,
    }),
  );
}

export async function updateBranch(
  supabase: Client,
  branch: { id: string; name: string; town: string; isActive: boolean },
) {
  return toResult(
    await supabase.rpc("school_update_branch", {
      p_branch_id: branch.id,
      p_name: branch.name,
      p_town: branch.town,
      p_is_active: branch.isActive,
    }),
  );
}
