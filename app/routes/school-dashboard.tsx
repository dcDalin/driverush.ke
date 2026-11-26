/**
 * `/school/:schoolId`: a driving school's dashboard, as tabs kept in the
 * address (`?tab=team`):
 *
 *   Students  everyone the school has added, in the branches the person works
 *             in (the owner and DriveRush staff see every branch), with their
 *             progress while their month runs and whether they have a pass.
 *             Search, filter and pages; add by email (they are emailed),
 *             re-send, release, withdraw, move between branches.
 *   Passes    the code learners pay through and the link to hand out; the
 *             owner sets the price (no ceiling, at least DriveRush's share
 *             plus a little) and sends the bank (DriveRush checks it).
 *             Earnings: what the school earned (an admin sees their branches).
 *   Team      (owner) the owner and admins, each admin's branches; add an
 *             admin by email (emailed), change their branches, remove them,
 *             re-send an invite. At most 50.
 *   Branches  (owner) add, rename, close.
 *   Profile   (owner, staff) what learners read about the school, the logos
 *             (uploaded through the server to Supabase Storage) and each
 *             branch's address, map pin, phone and hours.
 *
 * The loader reads through `getSchoolDashboard`; the action validates each
 * intent with its zod schema and calls the matching `~/database/schools`
 * function as the signed-in person, so row level security and the functions'
 * guards decide what they see and may do.
 */
import { data } from "react-router";

import { SiteNav } from "~/components/brand/site-nav";
import { BranchesPanel } from "~/components/school/branches-panel";
import { EarningsPanel, PassPanel } from "~/components/school/pass-panel";
import { ProfilePanel } from "~/components/school/profile-panel";
import { NeedsSignIn, NothingHere } from "~/components/school/signed-out";
import { StudentsPanel } from "~/components/school/students-panel";
import { TeamPanel } from "~/components/school/team-panel";
import {
  Alert,
  AlertBody,
  AlertDescription,
  AlertTitle,
} from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { isStaffRole } from "~/database/auth/roles";
import { requestSchoolBank } from "~/database/billing/bank.server";
import {
  getSchoolPassInfo,
  listSchoolEarnings,
  setPassPrice,
} from "~/database/billing/school";
import type { Result } from "~/database/result";
import { getSchoolDashboard } from "~/database/schools/dashboard";
import { uploadSchoolLogo } from "~/database/schools/logo.server";
import * as schools from "~/database/schools/mutations";
import {
  getMySchoolRole,
  getSchool,
  getSchoolProfile,
  getStudentLink,
  listBranches,
} from "~/database/schools/queries";
import { getRequestClient, requireUser } from "~/lib/auth/require.server";
import { mediaUrl } from "~/lib/board/school-catalog";
import {
  originOf,
  tellAdmin,
  tellOwner,
  tellStaffBankRequested,
  tellStudent,
} from "~/lib/email/notify.server";
import { formFields, readFormIntent } from "~/lib/forms/form-intent";
import { checkHoneypot } from "~/lib/forms/honeypot.server";
import { dataWithError, dataWithSuccess } from "~/lib/forms/toast.server";
import { validateForm } from "~/lib/forms/validate-form.server";
import { kenyanBanks } from "~/lib/payments/banks.server";
import { paymentsEnabled } from "~/lib/payments/env.server";
import {
  makeSubaccount,
  switchOffSubaccount,
} from "~/lib/payments/subaccounts.server";
import { useLiveRevalidate } from "~/lib/realtime/use-live-revalidate";
import { useTabParam } from "~/lib/ui/use-tab-param";
import { RequestBankSchema, SetPassPriceSchema } from "~/schemas/billing";
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
  const paymentsOn = paymentsEnabled();
  const [profile, passInfo, earnings, banks] = await Promise.all([
    dashboard.canManage
      ? getSchoolProfile(supabase, params.schoolId)
      : Promise.resolve(null),
    getSchoolPassInfo(supabase, params.schoolId),
    listSchoolEarnings(supabase, params.schoolId),
    dashboard.canManage && paymentsOn ? kenyanBanks() : Promise.resolve([]),
  ]);
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
      passInfo,
      earnings,
      paymentsOn,
      banks,
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
  "set-pass-price": "Price saved. New payments use it.",
  "request-bank":
    "Bank sent to DriveRush. We check it with you, then your learners can pay.",
  "resend-student": "Sent again. The invite lasts another 30 days.",
  "resend-invite": "Sent again. The invite lasts another 30 days.",
} as const;

export async function action({ request, params }: Route.ActionArgs) {
  const { supabase, headers, caller } = await requireUser(request);
  const formData = await request.formData();
  const intent = readFormIntent(formData);
  const schoolId = params.schoolId;
  const origin = originOf(request);
  const schoolName = async () =>
    (await getSchool(supabase, schoolId))?.name ?? "Your driving school";

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
        async (v) => {
          const added = await schools.addStudent(supabase, v.branchId, v.email);
          if (added.data) await emailStudent(added.data);
          return added;
        },
        DONE[intent],
      );
    case "add-admin":
      return form(
        await validateForm(formData, AddAdminSchema),
        async (v) => {
          const added = await schools.addAdmin(
            supabase,
            schoolId,
            v.email,
            v.branchIds,
          );
          // "updated": an admin already, branches changed; nothing to send.
          if (added.data === "added" || added.data === "invited") {
            const branches = await listBranches(supabase, schoolId);
            await tellAdmin(v.email, {
              school: await schoolName(),
              branches: branches
                .filter((b) => v.branchIds.includes(b.id))
                .map((b) => b.name),
              result: added.data === "invited" ? "invited" : "added",
              origin,
            });
          }
          return added;
        },
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
    case "set-pass-price":
      return form(
        await validateForm(formData, SetPassPriceSchema),
        (v) => setPassPrice(supabase, schoolId, v.priceKes),
        DONE[intent],
      );
    case "request-bank": {
      const validated = await validateForm(formData, RequestBankSchema);
      if (validated.errors || !validated.data) {
        return dataWithError(
          { ok: false as const, errors: validated.errors },
          "Check the highlighted fields.",
          { headers },
        );
      }
      const v = validated.data;
      // The owner gate first: the service role records the request.
      if (!(await canManageSchool(supabase, schoolId, caller))) {
        return dataWithError(
          { ok: false as const },
          "Only the school's owner can send its bank.",
          { status: 403, headers },
        );
      }
      const made = await makeSubaccount(v);
      if (!made.ok) {
        return dataWithError({ ok: false as const }, made.message, { headers });
      }
      const recorded = await requestSchoolBank({
        schoolId,
        actorId: caller.userId,
        subaccountCode: made.code,
        bankLabel: made.label,
        accountName: v.accountName,
      });
      if (recorded.error) {
        await switchOffSubaccount(made.code);
        return dataWithError({ ok: false as const }, recorded.error, {
          headers,
        });
      }
      await switchOffSubaccount(recorded.data);
      await tellStaffBankRequested({
        school: await schoolName(),
        bank: made.label,
        accountName: v.accountName,
        origin,
      });
      return dataWithSuccess({ ok: true as const }, DONE[intent], { headers });
    }
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
    if (v.intent === "resend-student") {
      // The database checks the branch, the 10 minutes and the 5 sends, and
      // renews the invite for 30 days; then the email goes.
      const sent = await schools.resendStudentInvite(supabase, v.linkId);
      if (sent.data) {
        await tellStudent(sent.data.email, {
          school: sent.data.school_name,
          branch: sent.data.branch_name,
          started: false,
          origin,
        });
      }
      return reply(sent, DONE[v.intent]);
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
    if (v.intent === "resend-invite") {
      const sent = await schools.resendMemberInvite(supabase, v.inviteId);
      if (sent.data) {
        const { email, role, branch_ids, school_name } = sent.data;
        if (role === "owner") {
          await tellOwner(email, {
            school: school_name,
            result: "invited",
            origin,
          });
        } else {
          const branches = await listBranches(supabase, schoolId);
          await tellAdmin(email, {
            school: school_name,
            branches: branches
              .filter((b) => branch_ids.includes(b.id))
              .map((b) => b.name),
            result: "invited",
            origin,
          });
        }
      }
      return reply(sent, DONE[v.intent]);
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

  /** Tells a student their school added them; false if the link is gone. */
  async function emailStudent(linkId: string) {
    const link = await getStudentLink(supabase, linkId);
    if (
      !link ||
      link.school_id !== schoolId ||
      (link.status !== "pending" && link.status !== "active")
    ) {
      return false;
    }
    await tellStudent(link.email, {
      school: await schoolName(),
      branch: link.school_branches?.name ?? null,
      started: link.status === "active",
      origin,
    });
    return true;
  }
}

/** The school's owner, or DriveRush staff: who may change its profile and bank. */
async function canManageSchool(
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"],
  schoolId: string,
  caller: Awaited<ReturnType<typeof requireUser>>["caller"],
) {
  if (isStaffRole(caller.role)) return true;
  return (await getMySchoolRole(supabase, schoolId, caller.userId)) === "owner";
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
          <Dashboard {...loaderData} />
        )}
      </main>
    </>
  );
}

const OWNER_TABS = [
  "students",
  "passes",
  "team",
  "branches",
  "profile",
] as const;
const ADMIN_TABS = ["students", "passes"] as const;

function Dashboard(
  d: Extract<Route.ComponentProps["loaderData"], { state: "ok" }>,
) {
  const [tab, setTab] = useTabParam(d.canManage ? OWNER_TABS : ADMIN_TABS);
  useLiveRevalidate([`school:${d.school.id}`]);
  const active = d.students.filter((s) => s.status === "active");
  const waiting = d.students.filter((s) => s.status === "pending").length;
  const paid = active.filter((s) => s.passEndsAt).length;
  const bankWaiting = Boolean(d.passInfo?.pending_bank_label);
  const noBank = d.canManage && !d.passInfo?.ready && !bankWaiting;
  return (
    <div className="flex flex-col gap-6 py-10">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-[28px] font-bold tracking-tight">
            {d.school.name}
          </h1>
          <Badge variant={d.role === "owner" ? "ink" : "outline"}>
            {d.role}
          </Badge>
          {d.school.status !== "active" && (
            <Badge variant="amber">{d.school.status}</Badge>
          )}
        </div>
        <p className="m-0 text-[14px] text-ink-3">
          {active.length} {active.length === 1 ? "student" : "students"} this
          month · {paid} with a pass · {waiting} waiting to join
        </p>
      </header>
      {noBank && tab !== "passes" ? (
        <Alert>
          <AlertBody>
            <AlertTitle>Add your bank to get paid</AlertTitle>
            <AlertDescription>
              <p className="m-0">
                Learners can pay through your school once DriveRush has checked
                your bank.{" "}
                <Button
                  type="button"
                  variant="quiet"
                  className="h-auto p-0"
                  onClick={() => setTab("passes")}
                >
                  Add it on Passes
                </Button>
              </p>
            </AlertDescription>
          </AlertBody>
        </Alert>
      ) : null}
      <Tabs value={tab} onValueChange={setTab}>
        <div className="-mx-5 overflow-x-auto px-5 [scrollbar-width:none] sm:mx-0 sm:px-0">
          <TabsList>
            <TabsTrigger value="students">Students</TabsTrigger>
            <TabsTrigger value="passes">
              Passes
              {noBank ? (
                <Badge variant="amber" className="ml-1">
                  !
                </Badge>
              ) : null}
            </TabsTrigger>
            {d.canManage ? (
              <>
                <TabsTrigger value="team">Team</TabsTrigger>
                <TabsTrigger value="branches">Branches</TabsTrigger>
                <TabsTrigger value="profile">Profile</TabsTrigger>
              </>
            ) : null}
          </TabsList>
        </div>
        <TabsContent value="students" className="pt-4">
          <StudentsPanel
            students={d.students}
            branches={d.branches}
            myBranchIds={d.myBranchIds}
          />
        </TabsContent>
        <TabsContent value="passes" className="flex flex-col gap-10 pt-4">
          <PassPanel
            schoolName={d.school.name}
            info={d.passInfo}
            canManage={d.canManage}
            paymentsOn={d.paymentsOn}
            banks={d.banks}
          />
          <EarningsPanel rows={d.earnings} ready={d.passInfo?.ready ?? false} />
        </TabsContent>
        {d.canManage ? (
          <>
            <TabsContent value="team" className="pt-4">
              <TeamPanel
                team={d.team}
                invites={d.invites}
                branches={d.branches}
              />
            </TabsContent>
            <TabsContent value="branches" className="pt-4">
              <BranchesPanel branches={d.branches} />
            </TabsContent>
            <TabsContent value="profile" className="pt-4">
              <ProfilePanel
                profile={d.profile}
                logos={d.logos}
                branches={d.branches}
              />
            </TabsContent>
          </>
        ) : null}
      </Tabs>
    </div>
  );
}
