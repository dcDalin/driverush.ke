/**
 * The DriveRush console's changes, shared by `/console` (the school list)
 * and `/console/schools/:schoolId` (one school): each route opens with its
 * own staff gate (`requireStaff`), then hands the form here. Every intent is
 * validated with its zod schema and done by one `~/database` function, and
 * the database checks the caller again (private.is_staff, private.is_su,
 * row level security).
 */
import { setSchoolPayments } from "~/database/billing/school";
import * as consoleDb from "~/database/console/mutations";
import { findAccountIdByEmail } from "~/database/console/queries";
import type { Result } from "~/database/result";
import type { SignedIn } from "~/lib/auth/require.server";
import { formFields, readFormIntent } from "~/lib/forms/form-intent";
import {
  dataWithError,
  dataWithSuccess,
  redirectWithSuccess,
} from "~/lib/forms/toast.server";
import { validateForm } from "~/lib/forms/validate-form.server";
import { bankLabel, kenyanBanks } from "~/lib/payments/banks.server";
import { getPaystackEnv, paymentsEnabled } from "~/lib/payments/env.server";
import {
  createSubaccount,
  PaystackError,
} from "~/lib/payments/paystack.server";
import { SetUpPaymentsSchema } from "~/schemas/billing";
import {
  ConsoleActionSchema,
  CreateSchoolSchema,
  GrantRoleSchema,
  HandOverSchema,
  SaveLiveryDraftSchema,
  SetSponsorshipSchema,
} from "~/schemas/console";

export async function consoleAction(staff: SignedIn, formData: FormData) {
  const { supabase, headers } = staff;
  const intent = readFormIntent(formData);

  const reply = (result: Result<unknown>, message: string) =>
    result.error
      ? dataWithError({ ok: false as const }, result.error, { headers })
      : dataWithSuccess({ ok: true as const }, message, { headers });
  const invalid = (errors: unknown) =>
    dataWithError(
      { ok: false as const, errors },
      "Check the highlighted fields.",
      { headers },
    );
  const noAccount = () =>
    dataWithError(
      { ok: false as const },
      "No account has that email. They sign up first.",
      { headers },
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
      return dataWithError({ ok: false as const }, result.error, { headers });
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
    const result = await consoleDb.handOverSchool(
      supabase,
      v.schoolId,
      v.email,
    );
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
        { headers },
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
    if (!paymentsEnabled()) {
      return dataWithError(
        { ok: false as const },
        "Payments are off on this server.",
        { headers },
      );
    }
    let subaccount: string;
    try {
      subaccount = (
        await createSubaccount(getPaystackEnv().secretKey, {
          businessName: v.businessName,
          bankCode: v.bankCode,
          accountNumber: v.accountNumber,
        })
      ).subaccount_code;
    } catch (error) {
      return dataWithError(
        { ok: false as const },
        error instanceof PaystackError
          ? `Paystack said: ${error.message}`
          : "Paystack did not answer. Try again.",
        { headers },
      );
    }
    return reply(
      await setSchoolPayments(supabase, {
        schoolId: v.schoolId,
        code: v.code,
        subaccountCode: subaccount,
        bankLabel: bankLabel(await kenyanBanks(), v.bankCode, v.accountNumber),
      }),
      "Payments on. The school's learners can pay through it now.",
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
