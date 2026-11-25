/**
 * The payment flow's writes, with the service role: only after Paystack
 * itself said how a payment ended (`~/lib/payments/pass-flow.server.ts`), from
 * the webhook or the return page. Settling and refunding are idempotent in the
 * database, so both may call them.
 */
import { toResult } from "../result";
import { getSupabaseServiceClient } from "../supabase/service.server";
import type { Json } from "../types";

export async function settlePayment(input: {
  reference: string;
  amountKes: number;
  feeKes: number;
  raw: Json;
}) {
  return toResult(
    await getSupabaseServiceClient().rpc("settle_payment", {
      p_reference: input.reference,
      p_amount_kes: input.amountKes,
      p_fee_kes: input.feeKes,
      p_raw: input.raw,
    }),
  );
}

export async function failPayment(reference: string, raw: Json) {
  return toResult(
    await getSupabaseServiceClient().rpc("fail_payment", {
      p_reference: reference,
      p_raw: raw,
    }),
  );
}

export async function refundPayment(reference: string, raw: Json) {
  return toResult(
    await getSupabaseServiceClient().rpc("refund_payment", {
      p_reference: reference,
      p_raw: raw,
    }),
  );
}

/** The Paystack subaccount a school's share settles to, or null if not set up. */
export async function getSchoolSubaccount(
  schoolId: string,
): Promise<string | null> {
  const { data, error } = await getSupabaseServiceClient()
    .from("school_payment_settings")
    .select("paystack_subaccount_code, is_active")
    .eq("school_id", schoolId)
    .maybeSingle();
  if (error) throw error;
  return data?.is_active ? (data.paystack_subaccount_code ?? null) : null;
}
