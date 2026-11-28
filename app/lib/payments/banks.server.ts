/**
 * Paystack's Kenyan banks for the console's payment setup, kept in memory for
 * six hours (the list barely changes). Empty when payments are off or
 * Paystack does not answer: the console says so.
 */
import { getPaystackEnv, paymentsEnabled } from "./env.server";
import { type KenyanBank, listKenyanBanks } from "./paystack.server";

const SIX_HOURS = 6 * 60 * 60 * 1000;
let cached: { at: number; banks: KenyanBank[] } | null = null;

export async function kenyanBanks(now = Date.now()): Promise<KenyanBank[]> {
  if (!paymentsEnabled()) return [];
  if (cached && now - cached.at < SIX_HOURS) return cached.banks;
  try {
    const banks = await listKenyanBanks(getPaystackEnv().secretKey);
    cached = { at: now, banks };
    return banks;
  } catch {
    return cached?.banks ?? [];
  }
}

/** "Equity Bank Kenya Ltd ••4321": what the school's team sees. */
export function bankLabel(
  banks: KenyanBank[],
  bankCode: string,
  account: string,
) {
  const name = banks.find((b) => b.code === bankCode)?.name ?? "Bank";
  return `${name} ••${account.slice(-4)}`;
}
