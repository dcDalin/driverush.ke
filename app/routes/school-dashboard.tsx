/**
 * `/school/:schoolId`: a driving school's dashboard.
 *
 *   Students  everyone the school has added, in the branches the person works
 *             in (the owner and DriveRush staff see every branch), with their
 *             progress while their month runs. Add by email, release, withdraw,
 *             move between branches.
 *   Team      (owner) the owner and admins, each admin's branches; add an
 *             admin by email, change their branches, remove them. At most 50.
 *   Branches  (owner) add, rename, close.
 *
 * Every read and change goes through the database as the signed-in person,
 * so row level security and the functions' guards decide what they see and
 * may do; the page only hides what they could not do anyway.
 */
import { data, redirect } from "react-router";

import { SiteNav } from "~/components/brand/site-nav";
import { BranchesPanel } from "~/components/school/branches-panel";
import { NeedsSignIn, NothingHere } from "~/components/school/signed-out";
import {
  type StudentRow,
  StudentsPanel,
} from "~/components/school/students-panel";
import { TeamPanel } from "~/components/school/team-panel";
import { Badge } from "~/components/ui/badge";
import { summarizeProgress } from "~/lib/school/progress-summary";
import {
  type ActionResult,
  reasonFor,
  signedInRequest,
} from "~/lib/school/server";
import { isStaff } from "~/lib/supabase/caller.server";

import type { Route } from "./+types/school-dashboard";

export function meta() {
  return [
    { title: "School dashboard | DriveRush" },
    { name: "robots", content: "noindex" },
  ];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { supabase, headers, caller } = await signedInRequest(request);
  if (!caller.signedIn)
    return data({ state: "signed-out" as const }, { headers });

  const schoolId = params.schoolId;
  const { data: school } = await supabase
    .from("schools")
    .select("id, name, status, sponsor_id")
    .eq("id", schoolId)
    .maybeSingle();
  if (!school) return data({ state: "not-member" as const }, { headers });

  const [{ data: branches }, team, { data: links }, progress] =
    await Promise.all([
      supabase
        .from("school_branches")
        .select("id, name, town, is_active")
        .eq("school_id", schoolId)
        .order("name"),
      supabase.rpc("school_members_list", { p_school_id: schoolId }),
      supabase
        .from("school_student_links")
        .select("id, email, status, branch_id, starts_at, ends_at, added_at")
        .eq("school_id", schoolId)
        .in("status", ["pending", "active"])
        .order("added_at", { ascending: false })
        .limit(1000),
      supabase.rpc("school_student_progress", { p_school_id: schoolId }),
    ]);

  const me = team.data?.find((m) => m.user_id === caller.userId);
  const staff = isStaff(caller);
  if (!me && !staff) return data({ state: "not-member" as const }, { headers });
  const role = me?.role ?? "staff";
  const canManage = role === "owner" || staff;

  const { data: invites } = canManage
    ? await supabase
        .from("school_member_invites")
        .select("id, email, role, branch_ids, created_at")
        .eq("school_id", schoolId)
        .eq("status", "pending")
        .order("created_at")
    : { data: [] };

  const byLink = new Map(
    (progress.data ?? []).map((row) => [row.link_id, row]),
  );
  const now = Date.now();
  const students: StudentRow[] = (links ?? []).map((link) => {
    const current =
      link.status === "active" &&
      link.ends_at &&
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

  return data(
    {
      state: "ok" as const,
      school,
      role,
      canManage,
      myBranchIds: canManage
        ? (branches ?? []).map((b) => b.id)
        : (me?.branch_ids ?? []),
      branches: branches ?? [],
      team: team.data ?? [],
      invites: invites ?? [],
      students,
    },
    { headers },
  );
}

export async function action({ request, params }: Route.ActionArgs) {
  const { supabase, headers, caller } = await signedInRequest(request);
  if (!caller.signedIn) throw redirect("/school", { headers });
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "");
  const text = (name: string) => String(form.get(name) ?? "").trim();
  const ids = (name: string) => form.getAll(name).map(String).filter(Boolean);
  const schoolId = params.schoolId;

  const calls: Record<
    string,
    () => PromiseLike<{ error: { code: string; message: string } | null }>
  > = {
    "add-student": () =>
      supabase.rpc("school_add_student", {
        p_branch_id: text("branchId"),
        p_email: text("email"),
      }),
    "release-student": () =>
      supabase.rpc("school_release_student", { p_link_id: text("linkId") }),
    "cancel-student": () =>
      supabase.rpc("school_cancel_student_invite", {
        p_link_id: text("linkId"),
      }),
    "move-student": () =>
      supabase.rpc("school_move_student_branch", {
        p_link_id: text("linkId"),
        p_branch_id: text("branchId"),
      }),
    "add-admin": () =>
      supabase.rpc("school_add_admin", {
        p_school_id: schoolId,
        p_email: text("email"),
        p_branch_ids: ids("branchIds"),
      }),
    "set-admin-branches": () =>
      supabase.rpc("school_set_admin_branches", {
        p_member_id: text("memberId"),
        p_branch_ids: ids("branchIds"),
      }),
    "remove-admin": () =>
      supabase.rpc("school_remove_admin", { p_member_id: text("memberId") }),
    "cancel-invite": () =>
      supabase.rpc("school_cancel_member_invite", {
        p_invite_id: text("inviteId"),
      }),
    "add-branch": () =>
      supabase.rpc("school_create_branch", {
        p_school_id: schoolId,
        p_name: text("name"),
        p_town: text("town"),
      }),
    "update-branch": () =>
      supabase.rpc("school_update_branch", {
        p_branch_id: text("branchId"),
        p_name: text("name"),
        p_town: text("town"),
        p_is_active: text("isActive") === "true",
      }),
  };
  const DONE: Record<string, string> = {
    "add-student": "Student added.",
    "release-student": "Student released.",
    "cancel-student": "Withdrawn.",
    "move-student": "Moved.",
    "add-admin": "Admin added.",
    "set-admin-branches": "Branches saved.",
    "remove-admin": "Admin removed.",
    "cancel-invite": "Invite withdrawn.",
    "add-branch": "Branch added.",
    "update-branch": "Branch saved.",
  };

  const call = calls[intent];
  if (!call)
    return data<ActionResult>(
      { ok: false, message: "Unknown action." },
      { status: 400, headers },
    );
  const { error } = await call();
  if (error)
    return data<ActionResult>(
      { ok: false, message: reasonFor(error) },
      { headers },
    );
  // every intent in `calls` has its line in DONE
  return data<ActionResult>({ ok: true, message: DONE[intent]! }, { headers });
}

export default function SchoolDashboard({ loaderData }: Route.ComponentProps) {
  return (
    <>
      <SiteNav />
      <main className="mx-auto min-h-screen w-full max-w-5xl px-5 pb-24 text-ink sm:px-9">
        {loaderData.state === "signed-out" ? (
          <NeedsSignIn
            title="School dashboard"
            body="Sign in with the email your school added you with to see your students and their progress."
          />
        ) : loaderData.state === "not-member" ? (
          <NothingHere
            title="Not your school"
            body="This account is not an owner or admin of this school."
          />
        ) : (
          <div className="flex flex-col gap-10 py-10">
            <header className="flex flex-wrap items-center gap-3">
              <h1 className="font-display text-[28px] font-bold tracking-tight">
                {loaderData.school.name}
              </h1>
              <Badge variant={loaderData.role === "owner" ? "ink" : "outline"}>
                {loaderData.role}
              </Badge>
              {loaderData.school.status !== "active" && (
                <Badge variant="amber">{loaderData.school.status}</Badge>
              )}
            </header>
            <StudentsPanel
              students={loaderData.students}
              branches={loaderData.branches}
              myBranchIds={loaderData.myBranchIds}
            />
            {loaderData.canManage && (
              <TeamPanel
                team={loaderData.team}
                invites={loaderData.invites}
                branches={loaderData.branches}
              />
            )}
            {loaderData.canManage && (
              <BranchesPanel branches={loaderData.branches} />
            )}
          </div>
        )}
      </main>
    </>
  );
}
