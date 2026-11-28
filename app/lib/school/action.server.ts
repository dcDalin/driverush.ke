/**
 * Every change a school's dashboard makes, shared by its frame and each page
 * under it (`/school/:schoolId/...`): a form posts to the page it is on, and
 * each route's action opens with `requireUser`, then hands over to this.
 *
 * It validates each intent with its zod schema and calls the matching
 * `~/database/schools` function as the signed-in person, so row level
 * security and the functions' guards decide what they may do.
 */
import { requestSchoolBank } from "~/database/billing/bank.server";
import { setPassPrice } from "~/database/billing/school";
import type { Result } from "~/database/result";
import { uploadSchoolLogo } from "~/database/schools/logo.server";
import * as schools from "~/database/schools/mutations";
import {
  getMySchoolRole,
  getSchool,
  getStudentLink,
  listBranches,
} from "~/database/schools/queries";
import type { SignedIn } from "~/lib/auth/require.server";
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
import {
  makeSubaccount,
  switchOffSubaccount,
} from "~/lib/payments/subaccounts.server";
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

export async function schoolAction(
  { supabase, headers, caller }: SignedIn,
  schoolId: string,
  request: Request,
) {
  // The school's own people only: DriveRush staff change a school from the
  // console (the database would let staff through here; the app does not).
  const myRole = await getMySchoolRole(supabase, schoolId, caller.userId);
  if (!myRole) {
    return dataWithError(
      { ok: false as const },
      "Only the school's owner and admins can change it.",
      { status: 403, headers },
    );
  }
  const formData = await request.formData();
  const intent = readFormIntent(formData);
  const origin = originOf(request);
  const schoolName = async () =>
    (await getSchool(supabase, schoolId))?.name ?? "Your driving school";

  const reply = (result: Result<unknown>, message: string) =>
    result.error
      ? dataWithError({ ok: false as const }, result.error, { headers })
      : dataWithSuccess({ ok: true as const }, message, { headers });

  // Forms with fields: the honeypot, then the same schema the browser used.
  const form = async <T>(
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

/** The school's owner: who may change its profile and bank. */
async function canManageSchool(
  supabase: SignedIn["supabase"],
  schoolId: string,
  caller: SignedIn["caller"],
) {
  return (await getMySchoolRole(supabase, schoolId, caller.userId)) === "owner";
}
