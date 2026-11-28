/**
 * The DriveRush console's changes, shared by `/console` (the school list)
 * and `/console/schools/:schoolId` (one school): each route opens with its
 * own staff gate (`requireStaff`), then hands the form here. Every intent is
 * validated with its zod schema and done by one `~/database` function, and
 * the database checks the caller again (private.is_staff, private.is_su,
 * row level security).
 */
import { reviewBank, setSchoolPayments } from "~/database/billing/school";
import * as consoleDb from "~/database/console/mutations";
import {
  findAccountIdByEmail,
  getConsoleSchool,
} from "~/database/console/queries";
import type { Result } from "~/database/result";
import type { SignedIn } from "~/lib/auth/require.server";
import {
  originOf,
  tellBankDecision,
  tellOwner,
} from "~/lib/email/notify.server";
import { formFields, readFormIntent } from "~/lib/forms/form-intent";
import {
  dataWithError,
  dataWithSuccess,
  redirectWithSuccess,
} from "~/lib/forms/toast.server";
import { validateForm } from "~/lib/forms/validate-form.server";
import {
  makeSubaccount,
  switchOffSubaccount,
} from "~/lib/payments/subaccounts.server";
import { emailHeldInvites } from "~/lib/school/action.server";
import { afterResponse } from "~/lib/server/after-response.server";
import {
  ReviewBankSchema,
  SetPassCodeSchema,
  SetUpPaymentsSchema,
} from "~/schemas/billing";
import {
  ConsoleActionSchema,
  CreateSchoolSchema,
  GrantRoleSchema,
  HandOverSchema,
  SaveLiveryDraftSchema,
  SetSponsorshipSchema,
} from "~/schemas/console";

export async function consoleAction(
  staff: SignedIn,
  formData: FormData,
  request: Request,
) {
  const { supabase, headers } = staff;
  const intent = readFormIntent(formData);
  const origin = originOf(request);

  const reply = (result: Result<unknown>, message: string) =>
    result.error
      ? dataWithError({ ok: false as const }, result.error, {
          status: 400,
          headers,
        })
      : dataWithSuccess({ ok: true as const }, message, { headers });
  const invalid = (errors: unknown) =>
    dataWithError(
      { ok: false as const, errors },
      "Check the highlighted fields.",
      { status: 400, headers },
    );
  const noAccount = () =>
    dataWithError(
      { ok: false as const },
      "No account has that email. They sign up first.",
      { status: 400, headers },
    );

  if (intent === "create-school") {
    const { errors, data: v } = await validateForm(
      formData,
      CreateSchoolSchema,
    );
    if (errors || !v) return invalid(errors);
    const result = await consoleDb.createSchool(supabase, {
      name: v.name,
      slug: v.slug,
      ownerEmail: v.ownerEmail,
    });
    if (result.error) {
      return dataWithError({ ok: false as const }, result.error, {
        status: 400,
        headers,
      });
    }
    const ownerEmail = v.ownerEmail;
    const schoolId = result.data;
    if (ownerEmail && schoolId) {
      await afterResponse(async () => {
        const school = await getConsoleSchool(supabase, schoolId);
        await tellOwner(ownerEmail, {
          school: v.name,
          result: school?.ownerEmail ? "added" : "invited",
          origin,
        });
      });
    }
    // Straight to the new school, to set it up or check it.
    return redirectWithSuccess(
      `/console/schools/${result.data}`,
      v.ownerEmail
        ? "School created. Its owner is invited."
        : "School created. Set it up, then hand it over.",
      { headers },
    );
  }

  if (intent === "hand-over") {
    const { errors, data: v } = await validateForm(formData, HandOverSchema);
    if (errors || !v) return invalid(errors);
    const before = await getConsoleSchool(supabase, v.schoolId);
    const result = await consoleDb.handOverSchool(
      supabase,
      v.schoolId,
      v.email,
      v.keepPrevious,
    );
    const handedOver = result.data;
    if (handedOver) {
      await afterResponse(async () => {
        const firstHandOver = before?.school.status === "setup";
        // The admins staff added while setting it up hear about it now.
        const admins = firstHandOver
          ? await emailHeldInvites(supabase, v.schoolId, origin)
          : 0;
        await tellOwner(v.email, {
          school: before?.school.name ?? "your driving school",
          result: handedOver === "invited" ? "invited" : "added",
          origin,
          ...(firstHandOver && before
            ? handOverLists(before.setup, admins)
            : {}),
        });
      });
    }
    return reply(
      result,
      result.data === "invited"
        ? "Handed over: they own it once they sign up with that email."
        : "Handed over: they own it now.",
    );
  }

  if (intent === "save-livery-draft") {
    const { errors, data: v } = await validateForm(
      formData,
      SaveLiveryDraftSchema,
    );
    if (errors || !v) {
      return dataWithError(
        { ok: false as const },
        "The upload did not finish. Try again.",
        { status: 400, headers },
      );
    }
    return reply(
      await consoleDb.createLiveryDraft(supabase, v.draft),
      "Livery saved as a draft. Preview it, then publish.",
    );
  }

  if (intent === "set-sponsorship") {
    const { errors, data: v } = await validateForm(
      formData,
      SetSponsorshipSchema,
    );
    if (errors || !v) return invalid(errors);
    return reply(
      await consoleDb.setSponsorship(supabase, v),
      "Sponsorship saved.",
    );
  }

  if (intent === "set-up-payments") {
    const { errors, data: v } = await validateForm(
      formData,
      SetUpPaymentsSchema,
    );
    if (errors || !v) return invalid(errors);
    const made = await makeSubaccount(v);
    if (!made.ok) {
      return dataWithError({ ok: false as const }, made.message, {
        status: 400,
        headers,
      });
    }
    const result = await setSchoolPayments(supabase, {
      schoolId: v.schoolId,
      code: v.code,
      subaccountCode: made.code,
      bankLabel: made.label,
      accountName: v.accountName,
    });
    await switchOffSubaccount(result.error ? made.code : result.data);
    return reply(
      result,
      "Bank live. The school's learners can pay through it now.",
    );
  }

  if (intent === "set-pass-code") {
    const { errors, data: v } = await validateForm(formData, SetPassCodeSchema);
    if (errors || !v) return invalid(errors);
    return reply(
      await setSchoolPayments(supabase, {
        schoolId: v.schoolId,
        code: v.code,
        subaccountCode: null,
        bankLabel: null,
        accountName: null,
      }),
      "Code saved. Links with the old code stop working.",
    );
  }

  if (intent === "review-bank") {
    const { errors, data: v } = await validateForm(formData, ReviewBankSchema);
    if (errors || !v) return invalid(errors);
    const approve = v.decision === "approve";
    const before = await getConsoleSchool(supabase, v.schoolId);
    const result = await reviewBank(supabase, {
      schoolId: v.schoolId,
      approve,
      note: v.note || null,
    });
    if (!result.error) {
      await switchOffSubaccount(result.data);
      const to = before?.ownerEmail;
      const bank = before?.payments?.pending_bank_label;
      if (to && before && bank) {
        await afterResponse(() =>
          tellBankDecision(to, {
            school: before.school.name,
            approved: approve,
            bank,
            note: v.note || null,
            origin,
          }),
        );
      }
    }
    return reply(
      result,
      approve
        ? "Bank approved. The school takes payments now."
        : "Bank turned down. The owner sees why.",
    );
  }

  if (intent === "grant-role") {
    const { errors, data: v } = await validateForm(formData, GrantRoleSchema);
    if (errors || !v) return invalid(errors);
    const userId = await findAccountIdByEmail(supabase, v.email);
    if (!userId) return noAccount();
    return reply(
      await consoleDb.grantPlatformRole(supabase, userId, v.role),
      "Role granted.",
    );
  }

  // Inline actions from keyed fetchers.
  const parsed = ConsoleActionSchema.safeParse(formFields(formData));
  if (!parsed.success) {
    return dataWithError(
      { ok: false as const },
      "Something is missing. Reload and try again.",
      { status: 400, headers },
    );
  }
  const v = parsed.data;
  switch (v.intent) {
    case "set-status":
      return reply(
        await consoleDb.setSchoolStatus(supabase, v.schoolId, v.status),
        "Status saved.",
      );
    case "publish-livery":
      return reply(
        await consoleDb.publishLivery(supabase, v.liveryId),
        "Livery published. Phones see it within a few minutes.",
      );
    case "retire-livery":
      return reply(
        await consoleDb.retireLivery(supabase, v.liveryId),
        "Livery taken off the board.",
      );
    case "delete-livery":
      return reply(
        await consoleDb.deleteLivery(supabase, v.liveryId),
        "Livery deleted.",
      );
    case "end-sponsorship":
      return reply(
        await consoleDb.endSponsorship(supabase, v.sponsorshipId),
        "Sponsorship ended today.",
      );
    case "revoke-role": {
      const userId = await findAccountIdByEmail(supabase, v.email);
      if (!userId) return noAccount();
      return reply(
        await consoleDb.revokePlatformRole(supabase, userId, v.role),
        "Role revoked.",
      );
    }
  }
}

/** What DriveRush set up before the hand-over, and what is left: for the owner's email. */
function handOverLists(
  setup: {
    logo: boolean;
    profile: boolean;
    branches: number;
    livery: "live" | "draft" | "none";
  },
  admins: number,
) {
  const done: string[] = [];
  const left: string[] = [];
  (setup.logo ? done : left).push("your logo");
  (setup.profile ? done : left).push("your profile");
  if (setup.branches > 0)
    done.push(
      `${setup.branches} ${setup.branches === 1 ? "branch" : "branches"}`,
    );
  else left.push("your first branch");
  if (admins > 0) done.push(`${admins} ${admins === 1 ? "admin" : "admins"}`);
  if (setup.livery === "live") done.push("your cars on the board");
  left.push("your bank", "your students");
  return { done, left };
}
