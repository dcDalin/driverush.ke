/**
 * `/school/:schoolId`: a driving school's dashboard.
 *
 *   Students  everyone the school has added, in the branches the person works
 *             in (the owner and DriveRush staff see every branch), with their
 *             progress while their month runs. Add by email, release, withdraw,
 *             move between branches.
 *   Team      (owner) the owner and admins, each admin's branches; add an
 *             admin by email, change their branches, remove them. At most 50.
 *   Branches  (owner) add, rename, close; address, map pin, phone, hours.
 *   Profile   (owner, staff) what learners read about the school: tagline,
 *             about, contacts, socials, brand colours, and the logos
 *             (uploaded through the server to Supabase Storage).
 *
 * The loader reads through `getSchoolDashboard`; the action validates each
 * intent with its zod schema and calls the matching `~/database/schools`
 * function as the signed-in person, so row level security and the functions'
 * guards decide what they see and may do.
 */
import { data } from "react-router";

import { SiteNav } from "~/components/brand/site-nav";
import { BranchesPanel } from "~/components/school/branches-panel";
import { ProfilePanel } from "~/components/school/profile-panel";
import { NeedsSignIn, NothingHere } from "~/components/school/signed-out";
import { StudentsPanel } from "~/components/school/students-panel";
import { TeamPanel } from "~/components/school/team-panel";
import { Badge } from "~/components/ui/badge";
import { isStaffRole } from "~/database/auth/roles";
import type { Result } from "~/database/result";
import { getSchoolDashboard } from "~/database/schools/dashboard";
import { uploadSchoolLogo } from "~/database/schools/logo.server";
import * as schools from "~/database/schools/mutations";
import { getSchoolProfile } from "~/database/schools/queries";
import { getRequestClient, requireUser } from "~/lib/auth/require.server";
import { mediaUrl } from "~/lib/board/school-catalog";
import { formFields, readFormIntent } from "~/lib/forms/form-intent";
import { checkHoneypot } from "~/lib/forms/honeypot.server";
import { dataWithError, dataWithSuccess } from "~/lib/forms/toast.server";
import { validateForm } from "~/lib/forms/validate-form.server";
import {
  AddAdminSchema,
  AddBranchSchema,
  AddStudentSchema,
  hoursFromForm,
  MemberActionSchema,
  SetAdminBranchesSchema,
  StudentActionSchema,
  UpdateBranchDetailsSchema,
  UpdateBranchSchema,
  UpdateProfileSchema,
  UploadLogoSchema,
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
  const profile = dashboard.canManage
    ? await getSchoolProfile(supabase, params.schoolId)
    : null;
  // Logos are shown from Storage by their public URL.
  const base = process.env.SUPABASE_URL ?? "";
  const logoUrl = (ref: unknown) => {
    const path = (ref as { path?: unknown } | null)?.path;
    return typeof path === "string" ? mediaUrl(base, path) : null;
  };
  return data(
    {
      state: "ok" as const,
      ...dashboard,
      profile,
      logos: {
        logo: logoUrl(profile?.logo),
        logo_mono: logoUrl(profile?.logo_mono),
      },
    },
    { headers },
  );
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
  "update-profile": "Profile saved. The site shows it within a few minutes.",
  "update-branch-details": "Branch details saved.",
  "upload-logo": "Logo saved.",
} as const;

export async function action({ request, params }: Route.ActionArgs) {
  const { supabase, headers, caller } = await requireUser(request);
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
    case "update-profile":
      return form(
        await validateForm(formData, UpdateProfileSchema),
        (v) =>
          schools.updateProfile(supabase, schoolId, {
            ...v,
            socials: Object.fromEntries(
              (["facebook", "instagram", "tiktok", "x", "youtube"] as const)
                .filter((network) => v[network])
                .map((network) => [network, v[network]]),
            ),
          }),
        DONE[intent],
      );
    case "update-branch-details":
      return form(
        await validateForm(formData, UpdateBranchDetailsSchema),
        (v) =>
          schools.updateBranchDetails(supabase, {
            id: v.branchId,
            address: v.address,
            lat: v.lat === "" ? null : Number(v.lat),
            lng: v.lng === "" ? null : Number(v.lng),
            phone: v.phone,
            hours: hoursFromForm(v),
          }),
        DONE[intent],
      );
    case "upload-logo": {
      // A file, so a plain multipart form: the honeypot, the same checks
      // the browser made, then the owner gate before the service role acts.
      await checkHoneypot(formData);
      const parsed = UploadLogoSchema.safeParse({
        intent,
        kind: formData.get("kind"),
        file: formData.get("file"),
      });
      if (!parsed.success) {
        return dataWithError(
          { ok: false as const },
          parsed.error.issues[0]?.message ?? "Choose a picture.",
          { headers },
        );
      }
      if (!(await canManageSchool(supabase, schoolId, caller))) {
        return dataWithError(
          { ok: false as const },
          "Only the school's owner can change its logo.",
          { status: 403, headers },
        );
      }
      return reply(
        await uploadSchoolLogo({
          schoolId,
          kind: parsed.data.kind,
          file: parsed.data.file,
          actorId: caller.userId,
        }),
        DONE[intent],
      );
    }
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

/** The school's owner, or DriveRush staff: who may change its profile. */
async function canManageSchool(
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"],
  schoolId: string,
  caller: Awaited<ReturnType<typeof requireUser>>["caller"],
) {
  if (isStaffRole(caller.role)) return true;
  const { data: member } = await supabase
    .from("school_members")
    .select("role")
    .eq("school_id", schoolId)
    .eq("user_id", caller.userId)
    .maybeSingle();
  return member?.role === "owner";
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
            {loaderData.canManage && (
              <ProfilePanel
                profile={loaderData.profile}
                logos={loaderData.logos}
                branches={loaderData.branches}
              />
            )}
          </div>
        )}
      </main>
    </>
  );
}
