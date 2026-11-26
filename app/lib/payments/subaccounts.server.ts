/**
 * A school's Paystack subaccounts, server only: making one from the bank
 * details (the details stay in Paystack; we keep a label), and switching a
 * replaced or refused one off so it can never be paid. Switching off is best
 * effort: the database already points at the new one.
 */
import { bankLabel, kenyanBanks } from "./banks.server";
import { getPaystackEnv, paymentsEnabled } from "./env.server";
import {
  createSubaccount,
  deactivateSubaccount,
  PaystackError,
} from "./paystack.server";

export type MadeSubaccount =
  { ok: true; code: string; label: string } | { ok: false; message: string };

export async function makeSubaccount(input: {
  accountName: string;
  bankCode: string;
  accountNumber: string;
}): Promise<MadeSubaccount> {
  if (!paymentsEnabled()) {
    return { ok: false, message: "Payments are off on this server." };
  }
  try {
    const made = await createSubaccount(getPaystackEnv().secretKey, {
      businessName: input.accountName,
      bankCode: input.bankCode,
      accountNumber: input.accountNumber,
    });
    return {
      ok: true,
      code: made.subaccount_code,
      label: bankLabel(
        await kenyanBanks(),
        input.bankCode,
        input.accountNumber,
      ),
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof PaystackError
          ? `Paystack said: ${error.message}`
          : "Paystack did not answer. Try again.",
    };
  }
}

/** Switches an old subaccount off on Paystack, if there is one. */
export async function switchOffSubaccount(code: string | null | undefined) {
  if (!code || !paymentsEnabled() || code.startsWith("ACCT_demo_")) return;
  try {
    await deactivateSubaccount(getPaystackEnv().secretKey, code);
  } catch (error) {
    console.error(
      `[paystack] could not switch off ${code}:`,
      error instanceof Error ? error.message : error,
    );
  }
}
