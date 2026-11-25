/**
 * A school's side of the passes, as the signed-in team member: its code and
 * price, setting the price (owner), and what it earned (by branch for
 * admins). Staff set up a school's payments (`setSchoolPayments`). Reads
 * throw, writes return a `Result`.
 */
import { orThrow, toResult } from "../result";
import type { TypedSupabaseClient } from "../types";

export type SchoolPassInfo = {
  code: string;
  price_kes: number;
  driverush_share_kes: number;
  /** Paystack subaccount in place and switched on. */
  ready: boolean;
  /** Owner and staff only ("Equity ••4321"). */
  bank_label: string | null;
};

export async function getSchoolPassInfo(
  supabase: TypedSupabaseClient,
  schoolId: string,
): Promise<SchoolPassInfo | null> {
  const rows = orThrow(
    await supabase.rpc("school_pass_info", { p_school_id: schoolId }),
  );
  return rows[0] ?? null;
}

export type EarningRow = {
  payment_id: string;
  paid_at: string;
  learner_email: string | null;
  branch_id: string | null;
  branch_name: string | null;
  price_kes: number;
  school_share_kes: number;
  status: "pending" | "succeeded" | "failed" | "refunded";
};

export async function listSchoolEarnings(
  supabase: TypedSupabaseClient,
  schoolId: string,
): Promise<EarningRow[]> {
  return orThrow(
    await supabase.rpc("school_earnings", { p_school_id: schoolId }),
  );
}

export async function setPassPrice(
  supabase: TypedSupabaseClient,
  schoolId: string,
  priceKes: number,
) {
  return toResult(
    await supabase.rpc("school_set_pass_price", {
      p_school_id: schoolId,
      p_price_kes: priceKes,
    }),
  );
}

/** Staff: the school's code and the Paystack subaccount made for it. */
export async function setSchoolPayments(
  supabase: TypedSupabaseClient,
  input: {
    schoolId: string;
    code: string;
    subaccountCode: string;
    bankLabel: string;
  },
) {
  return toResult(
    await supabase.rpc("admin_set_school_payments", {
      p_school_id: input.schoolId,
      p_code: input.code,
      p_subaccount_code: input.subaccountCode,
      p_bank_label: input.bankLabel,
      p_is_active: true,
    }),
  );
}

/** Staff: every school's payment settings, by school id. */
export async function listSchoolPaymentSettings(
  supabase: TypedSupabaseClient,
): Promise<
  Map<
    string,
    {
      code: string;
      price_kes: number;
      bank_label: string | null;
      ready: boolean;
    }
  >
> {
  const rows = orThrow(
    await supabase
      .from("school_payment_settings")
      .select(
        "school_id, code, price_kes, bank_label, is_active, paystack_subaccount_code",
      ),
  );
  return new Map(
    rows.map((row) => [
      row.school_id,
      {
        code: String(row.code),
        price_kes: row.price_kes,
        bank_label: row.bank_label,
        ready: row.is_active && row.paystack_subaccount_code !== null,
      },
    ]),
  );
}

/** This month and last month's earnings, in Nairobi's calendar. */
export function earningsTotals(rows: EarningRow[], now = Date.now()) {
  const month = (iso: string | number) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Africa/Nairobi",
      year: "numeric",
      month: "2-digit",
    }).format(new Date(iso));
  const thisMonth = month(now);
  const [y, m] = thisMonth.split("-").map(Number) as [number, number];
  const lastMonth =
    m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
  const paid = rows.filter((r) => r.status === "succeeded");
  const sum = (key: string) =>
    paid
      .filter((r) => month(r.paid_at) === key)
      .reduce(
        (total, r) => ({
          kes: total.kes + r.school_share_kes,
          learners: total.learners + 1,
        }),
        { kes: 0, learners: 0 },
      );
  return { thisMonth: sum(thisMonth), lastMonth: sum(lastMonth) };
}
