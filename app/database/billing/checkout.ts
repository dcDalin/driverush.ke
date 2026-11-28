/**
 * A learner buying a pass, as the learner (row level security and the
 * functions' guards apply): the offers they can take, starting a payment, and
 * reading their own payment back. The money itself is Paystack's
 * (`~/lib/payments/`). Reads throw, writes return a `Result`.
 */
import { fail, ok, orThrow, type Result, toResult } from "../result";
import type { TypedSupabaseClient } from "../types";

export type PassPlan = "learner_pass" | "school_pass" | "learner_extension";

export type PlanPrice = {
  code: PassPlan;
  price_kes: number;
  days: number;
  /** The school pass: what DriveRush keeps of the school's price. */
  driverush_share_kes: number | null;
};

/** The public price of each pass (the school pass's price is the school's). */
export async function listPassPlans(
  supabase: TypedSupabaseClient,
): Promise<PlanPrice[]> {
  const rows = orThrow(
    await supabase
      .from("plans")
      .select("code, price_kes, period, limits")
      .in("code", ["learner_pass", "school_pass", "learner_extension"]),
  );
  return rows.map((row) => ({
    code: row.code as PassPlan,
    price_kes: row.price_kes,
    days: daysOf(String(row.period)),
    driverush_share_kes: shareOf(row.limits),
  }));
}

function shareOf(limits: unknown): number | null {
  const share = (limits as { driverush_share_kes?: unknown } | null)
    ?.driverush_share_kes;
  return typeof share === "number" ? share : null;
}

/** Postgres prints `interval '60 days'` as "60 days" (or "1 mon"). */
function daysOf(period: string): number {
  const days = /(\d+)\s+day/.exec(period);
  if (days) return Number(days[1]);
  const months = /(\d+)\s+mon/.exec(period);
  return months ? Number(months[1]) * 30 : 0;
}

export type SchoolOffer = {
  school_id: string;
  school_name: string;
  school_slug: string;
  price_kes: number;
  branches: { id: string; name: string; town: string | null }[];
};

/** A school's offer from its code, or null if the code takes no payments. */
export async function passSchoolByCode(
  supabase: TypedSupabaseClient,
  code: string,
): Promise<SchoolOffer | null> {
  const rows = orThrow(
    await supabase.rpc("pass_school_by_code", { p_code: code }),
  );
  const row = rows[0];
  if (!row) return null;
  return {
    ...row,
    branches: Array.isArray(row.branches)
      ? (row.branches as SchoolOffer["branches"])
      : [],
  };
}

export type MyPassOffer = {
  school_id: string;
  school_name: string;
  code: string;
  price_kes: number;
  branch_id: string;
  branch_name: string;
  /** Their current school (else a school waiting for them). */
  linked: boolean;
};

/** The schools the learner can pay through without a code. */
export async function listMyPassOffers(
  supabase: TypedSupabaseClient,
): Promise<MyPassOffer[]> {
  return orThrow(await supabase.rpc("my_pass_offers"));
}

/** Whether the learner has ever had a pass (an extension needs one). */
export async function hasHadPass(
  supabase: TypedSupabaseClient,
  userId: string,
): Promise<boolean> {
  const rows = orThrow(
    await supabase
      .from("learner_subscriptions")
      .select("id")
      .eq("user_id", userId)
      .eq("status", "active")
      .limit(1),
  );
  return rows.length > 0;
}

export type StartedCheckout = {
  payment_id: string;
  reference: string;
  amount_kes: number;
  email: string;
  school_id: string | null;
  school_name: string | null;
};

/** A pending payment for the caller, amounts worked out by the database. */
export async function startPassCheckout(
  supabase: TypedSupabaseClient,
  input: { plan: PassPlan; schoolCode?: string; branchId?: string },
): Promise<Result<StartedCheckout>> {
  const result = toResult(
    await supabase.rpc("start_pass_checkout", {
      p_plan_code: input.plan,
      p_school_code: input.schoolCode || undefined,
      p_branch_id: input.branchId || undefined,
    }),
  );
  if (result.error !== null) return fail(result.error);
  const row = result.data?.[0];
  return row
    ? ok(row as StartedCheckout)
    : fail("Something went wrong. Try again.");
}

export type MyPayment = {
  id: string;
  status: "pending" | "succeeded" | "failed" | "refunded";
  amount_kes: number;
  school_id: string | null;
};

/** The caller's own payment by our reference (row level security: payer only). */
export async function getMyPayment(
  supabase: TypedSupabaseClient,
  reference: string,
): Promise<MyPayment | null> {
  return orThrow(
    await supabase
      .from("payments")
      .select("id, status, amount_kes, school_id")
      .eq("provider", "paystack")
      .eq("provider_ref", reference)
      .maybeSingle(),
  );
}
