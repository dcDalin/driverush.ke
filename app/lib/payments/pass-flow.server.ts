/**
 * The pass checkout, end to end (owner, 2026-11-25):
 *
 *   1. `beginCheckout` (the /pass action, as the learner): the database writes
 *      a pending payment with the amounts fixed; we start the payment on
 *      Paystack with our reference, the school's subaccount and DriveRush's
 *      flat share; the learner goes to Paystack's page (M-PESA prompt or card).
 *   2. `confirmPayment` (the return page and the webhook): we ask Paystack how
 *      it ended and settle or fail the payment with the service role. Settling
 *      twice changes nothing, so whichever comes first wins.
 *
 * Nothing here trusts the browser or the webhook body for an amount: Paystack's
 * verify answer and the payment row are the only sources.
 */
import { startPassCheckout } from "~/database/billing/checkout";
import {
  failPayment,
  getSchoolSubaccount,
  settlePayment,
} from "~/database/billing/settle.server";
import { fail, ok, type Result } from "~/database/result";
import { getSupabaseServiceClient } from "~/database/supabase/service.server";
import type { Json, TypedSupabaseClient } from "~/database/types";
import type { BuyPassSchemaTypes } from "~/schemas/billing";

import { getPaystackEnv, paymentsEnabled } from "./env.server";
import {
  initializeTransaction,
  PaystackError,
  verifyTransaction,
} from "./paystack.server";

export const PASS_DONE_PATH = "/pass/done";

type Fetch = typeof fetch;

/** Where Paystack sends the learner back: our return page, with the level to go on to. */
export function callbackUrl(requestUrl: string, level?: string) {
  const url = new URL(PASS_DONE_PATH, requestUrl);
  if (level) url.searchParams.set("level", level);
  return url.toString();
}

async function shareOf(reference: string) {
  const { data, error } = await getSupabaseServiceClient()
    .from("payments")
    .select("driverush_share_kes, school_id")
    .eq("provider", "paystack")
    .eq("provider_ref", reference)
    .single();
  if (error) throw error;
  return data;
}

/** Starts a payment and returns Paystack's checkout address. */
export async function beginCheckout(
  supabase: TypedSupabaseClient,
  input: BuyPassSchemaTypes,
  requestUrl: string,
  fetchFn?: Fetch,
): Promise<Result<{ url: string; reference: string }>> {
  if (!paymentsEnabled()) {
    return fail("Payments are not switched on yet. Try again soon.");
  }
  const { secretKey } = getPaystackEnv();

  const started = await startPassCheckout(supabase, {
    plan: input.plan,
    ...(input.plan === "school_pass"
      ? { schoolCode: input.schoolCode, branchId: input.branchId }
      : {}),
  });
  if (started.error !== null) return fail(started.error);
  const checkout = started.data;

  let split: { subaccount: string; driverushShareKes: number } | undefined;
  if (checkout.school_id) {
    const subaccount = await getSchoolSubaccount(checkout.school_id);
    if (!subaccount) {
      await failPayment(checkout.reference, { why: "no subaccount" });
      return fail(
        "That school code does not take payments. Check it with your school.",
      );
    }
    const { driverush_share_kes } = await shareOf(checkout.reference);
    split = { subaccount, driverushShareKes: driverush_share_kes };
  }

  try {
    const started = await initializeTransaction(
      secretKey,
      {
        email: checkout.email,
        amountKes: checkout.amount_kes,
        reference: checkout.reference,
        callbackUrl: callbackUrl(requestUrl, input.level),
        metadata: {
          payment_id: checkout.payment_id,
          plan: input.plan,
          school: checkout.school_name,
        },
        split,
      },
      fetchFn,
    );
    return ok({
      url: started.authorization_url,
      reference: checkout.reference,
    });
  } catch (error) {
    await failPayment(checkout.reference, {
      why: "initialize failed",
      message: error instanceof Error ? error.message : String(error),
    });
    if (error instanceof PaystackError) {
      return fail("Paystack could not start the payment. Try again.");
    }
    throw error;
  }
}

export type Confirmed =
  | { outcome: "paid" }
  | { outcome: "failed"; status: string }
  | { outcome: "waiting"; status: string }
  | { outcome: "problem"; message: string };

/** Paystack's last word on a payment, written to the database. */
export async function confirmPayment(
  reference: string,
  fetchFn?: Fetch,
): Promise<Confirmed> {
  const { secretKey } = getPaystackEnv();
  let verified;
  try {
    verified = await verifyTransaction(secretKey, reference, fetchFn);
  } catch (error) {
    if (error instanceof PaystackError) {
      return { outcome: "waiting", status: "unknown" };
    }
    throw error;
  }

  if (verified.succeeded) {
    const settled = await settlePayment({
      reference,
      amountKes: verified.amountKes,
      feeKes: verified.feeKes,
      raw: verified.raw as Json,
    });
    return settled.error
      ? { outcome: "problem", message: settled.error }
      : { outcome: "paid" };
  }

  if (["failed", "abandoned", "reversed"].includes(verified.status)) {
    // A failed payment can still settle later if Paystack says so.
    await failPayment(reference, verified.raw as Json);
    return { outcome: "failed", status: verified.status };
  }
  return { outcome: "waiting", status: verified.status };
}
