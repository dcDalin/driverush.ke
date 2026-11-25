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
 * The loader reads through `getSchoolDashboard`; the action validates each
 * intent with its zod schema and calls the matching `~/database/schools`
 * function as the signed-in person, so row level security and the functions'
 * guards decide what they see and may do.
 */
import { data } from "react-router";

import { SiteNav } from "~/components/brand/site-nav";
import { BranchesPanel } from "~/components/school/branches-panel";
import { NeedsSignIn, NothingHere } from "~/components/school/signed-out";
import { StudentsPanel } from "~/components/school/students-panel";
import { TeamPanel } from "~/components/school/team-panel";
import { Badge } from "~/components/ui/badge";
import type { Result } from "~/database/result";
import { getSchoolDashboard } from "~/database/schools/dashboard";
import * as schools from "~/database/schools/mutations";
import { getRequestClient, requireUser } from "~/lib/auth/require.server";
import { formFields, readFormIntent } from "~/lib/forms/form-intent";
import { dataWithError, dataWithSuccess } from "~/lib/forms/toast.server";
import { validateForm } from "~/lib/forms/validate-form.server";
import {
  AddAdminSchema,
  AddBranchSchema,
  AddStudentSchema,
  MemberActionSchema,
  SetAdminBranchesSchema,
  StudentActionSchema,
  UpdateBranchSchema,
} from "~/schemas/school";

import type { Route } from "./+types/school-dashboard";

export function meta() {
  return [
    { title: "School dashboard | DriveRush" },
    { name: "robots", content: "noindex" },
  ];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { supabase, headers, caller } = await getRequestClient(request);
  if (!caller.signedIn)
    return data({ state: "signed-out" as const }, { headers });
  const dashboard = await getSchoolDashboard(supabase, {
    schoolId: params.schoolId,
    userId: caller.userId,
    role: caller.role,
  });
  if (!dashboard) return data({ state: "not-member" as const }, { headers });
  return data({ state: "ok" as const, ...dashboard }, { headers });
}

const DONE = {
  "add-student": "Student added.",
  "add-admin": "Admin added.",
  "add-branch": "Branch added.",
  "update-branch": "Branch saved.",
  "set-admin-branches": "Branches saved.",
  "release-student": "Student released.",
  "cancel-student": "Withdrawn.",
  "move-student": "Moved.",
  "remove-admin": "Admin removed.",
  "cancel-invite": "Invite withdrawn.",
} as const;

export async function action({ request, params }: Route.ActionArgs) {
  const { supabase, headers } = await requireUser(request);
  const formData = await request.formData();
  const intent = readFormIntent(formData);
  const schoolId = params.schoolId;

  const reply = (result: Result<unknown>, message: string) =>
    result.error
      ? dataWithError({ ok: false as const }, result.error, { headers })
      : dataWithSuccess({ ok: true as const }, message, { headers });

  // Forms with fields: the honeypot, then the same schema the browser used.
  const form = async <T,>(
    validated: { errors?: unknown; data?: T },
    run: (values: T) => Promise<Result<unknown>>,
    message: string,
  ) => {
    if (validated.errors || !validated.data) {
      return dataWithError(
        { ok: false as const, errors: validated.errors },
        "Check the highlighted fields.",
        { headers },
      );
    }
    return reply(await run(validated.data), message);
  };

  switch (intent) {
    case "add-student":
      return form(
        await validateForm(formData, AddStudentSchema),
        (v) => schools.addStudent(supabase, v.branchId, v.email),
        DONE[intent],
      );
    case "add-admin":
      return form(
        await validateForm(formData, AddAdminSchema),
        (v) => schools.addAdmin(supabase, schoolId, v.email, v.branchIds),
        DONE[intent],
      );
    case "add-branch":
      return form(
        await validateForm(formData, AddBranchSchema),
        (v) => schools.createBranch(supabase, schoolId, v.name, v.town),
        DONE[intent],
      );
    case "update-branch":
      return form(
        await validateForm(formData, UpdateBranchSchema),
        (v) =>
          schools.updateBranch(supabase, {
            id: v.branchId,
            name: v.name,
            town: v.town,
            isActive: v.isActive,
          }),
        DONE[intent],
      );
    case "set-admin-branches":
      return form(
        await validateForm(formData, SetAdminBranchesSchema),
        (v) => schools.setAdminBranches(supabase, v.memberId, v.branchIds),
        DONE[intent],
      );
  }

  // Inline actions from keyed fetchers (buttons, no fields to show).
  const student = StudentActionSchema.safeParse(formFields(formData));
  if (student.success) {
    const v = student.data;
    if (v.intent === "release-student") {
      return reply(
        await schools.releaseStudent(supabase, v.linkId),
        DONE[v.intent],
      );
    }
    if (v.intent === "cancel-student") {
      return reply(
        await schools.cancelStudentInvite(supabase, v.linkId),
        DONE[v.intent],
      );
    }
    return reply(
      await schools.moveStudent(supabase, v.linkId, v.branchId),
      DONE[v.intent],
    );
  }
  const member = MemberActionSchema.safeParse(formFields(formData));
  if (member.success) {
    const v = member.data;
    if (v.intent === "remove-admin") {
      return reply(
        await schools.removeAdmin(supabase, v.memberId),
        DONE[v.intent],
      );
    }
    return reply(
      await schools.cancelMemberInvite(supabase, v.inviteId),
      DONE[v.intent],
    );
  }
  return dataWithError(
    { ok: false as const },
    "Something is missing. Reload and try again.",
    { status: 400, headers },
  );
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
