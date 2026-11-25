/**
 * Everything a school's dashboard shows, in one call for its loader: the
 * school, the caller's place in it, branches, team, invites and students
 * (each with a progress summary while their month runs). Null when the
 * school does not exist or the caller has no place in it.
 */
import { isStaffRole } from "../auth/roles";
import type { AppRole, SchoolRole, TypedSupabaseClient } from "../types";
import { type ProgressSummary, summarizeProgress } from "./progress-summary";
import {
  getSchool,
  listBranches,
  listOpenStudentLinks,
  listPendingMemberInvites,
  listSchoolMembers,
  listStudentProgress,
} from "./queries";

export type StudentRow = {
  id: string;
  email: string;
  name: string | null;
  branchId: string;
  status: "pending" | "active" | "ended";
  endsAt: string | null;
  summary: ProgressSummary | null;
};

export type DashboardRole = SchoolRole | "staff";

export async function getSchoolDashboard(
  supabase: TypedSupabaseClient,
  {
    schoolId,
    userId,
    role,
  }: { schoolId: string; userId: string; role: AppRole },
  now = Date.now(),
) {
  const school = await getSchool(supabase, schoolId);
  if (!school) return null;

  const [branches, team, links, progress] = await Promise.all([
    listBranches(supabase, schoolId),
    listSchoolMembers(supabase, schoolId),
    listOpenStudentLinks(supabase, schoolId),
    listStudentProgress(supabase, schoolId),
  ]);

  const me = team.find((m) => m.user_id === userId);
  const staff = isStaffRole(role);
  if (!me && !staff) return null;
  const myRole: DashboardRole = me?.role ?? "staff";
  const canManage = myRole === "owner" || staff;
  const invites = canManage
    ? await listPendingMemberInvites(supabase, schoolId)
    : [];

  const byLink = new Map(progress.map((row) => [row.link_id, row]));
  const students: StudentRow[] = links.map((link) => {
    const current =
      link.status === "active" &&
      link.ends_at !== null &&
      Date.parse(link.ends_at) > now;
    const row = byLink.get(link.id);
    return {
      id: link.id,
      email: link.email,
      name: row?.full_name ?? null,
      branchId: link.branch_id,
      status:
        link.status === "pending" ? "pending" : current ? "active" : "ended",
      endsAt: link.ends_at,
      summary: row ? summarizeProgress(row.progress) : null,
    };
  });

  return {
    school,
    role: myRole,
    canManage,
    myBranchIds: canManage ? branches.map((b) => b.id) : (me?.branch_ids ?? []),
    branches,
    team,
    invites,
    students,
  };
}

export type SchoolDashboard = NonNullable<
  Awaited<ReturnType<typeof getSchoolDashboard>>
>;
