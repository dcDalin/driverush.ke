/**
 * The few Paystack calls DriveRush makes, over plain fetch (no SDK).
 *
 * Money flow: a learner pays on Paystack's checkout page (M-PESA prompt or
 * card). A school pass carries the school's subaccount and a flat
 * `transaction_charge` (DriveRush's KES 300), so Paystack splits the payment
 * at source and settles the school's share to the school's bank itself.
 * `bearer: "subaccount"` (owner, 2026-11-26): the school's share pays
 * Paystack's fee, so DriveRush always receives its whole share, whatever price
 * the school sets. DriveRush never holds a school's money.
 *
 * Amounts: callers speak whole shillings; Paystack speaks subunits (KES x 100).
 * Access is granted only after `verifyTransaction` says "success" for the
 * amount we asked for, from the webhook (`charge.success`) or the return page,
 * whichever comes first; settling is idempotent in the database.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

import { z } from "zod";

const API = "https://api.paystack.co";

/** Signatures older than this are refused (Paystack's own advice). */
export const SIGNATURE_MAX_AGE_S = 300;

type Fetch = typeof fetch;

export class PaystackError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "PaystackError";
  }
}

/** Whole shillings to Paystack subunits. */
export function toSubunits(kes: number): number {
  if (!Number.isInteger(kes) || kes < 0) {
    throw new RangeError(`Not a whole, non-negative KES amount: ${kes}`);
  }
  return kes * 100;
}

/** Paystack subunits to shillings (fees can be fractional shillings). */
export function fromSubunits(subunits: number): number {
  return subunits / 100;
}

const envelope = z.object({
  status: z.boolean(),
  message: z.string(),
  data: z.unknown(),
});

async function call<T extends z.ZodType>(
  secretKey: string,
  path: string,
  schema: T,
  init: { method?: "GET" | "POST" | "PUT"; body?: unknown; fetch?: Fetch } = {},
): Promise<z.infer<T>> {
  const res = await (init.fetch ?? fetch)(`${API}${path}`, {
    method: init.method ?? "GET",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      ...(init.body === undefined
        ? {}
        : { "Content-Type": "application/json" }),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const json: unknown = await res.json().catch(() => null);
  const message =
    json && typeof json === "object" && "message" in json
      ? String(json.message)
      : `Paystack answered ${res.status}`;
  if (!res.ok) throw new PaystackError(message, res.status);
  const wrapped = envelope.safeParse(json);
  if (!wrapped.success || !wrapped.data.status) {
    throw new PaystackError(message, res.status);
  }
  const parsed = schema.safeParse(wrapped.data.data);
  if (!parsed.success) {
    throw new PaystackError(`Unexpected answer from Paystack: ${message}`, 502);
  }
  return parsed.data;
}

export type InitializeInput = {
  email: string;
  amountKes: number;
  /** Our own reference (the payments row's provider_ref), unique per try. */
  reference: string;
  callbackUrl: string;
  metadata?: Record<string, string | number | null>;
  /** A school pass: the school's subaccount and DriveRush's flat share. */
  split?: { subaccount: string; driverushShareKes: number };
};

const initializeData = z.object({
  authorization_url: z.url(),
  access_code: z.string(),
  reference: z.string(),
});

/** Start a payment on Paystack's checkout page; send the learner to `authorization_url`. */
export function initializeTransaction(
  secretKey: string,
  input: InitializeInput,
  fetchFn?: Fetch,
) {
  if (input.split && input.split.driverushShareKes >= input.amountKes) {
    throw new RangeError("DriveRush's share must be less than the price.");
  }
  return call(secretKey, "/transaction/initialize", initializeData, {
    method: "POST",
    fetch: fetchFn,
    body: {
      email: input.email,
      amount: toSubunits(input.amountKes),
      currency: "KES",
      reference: input.reference,
      callback_url: input.callbackUrl,
      channels: ["mobile_money", "card"],
      metadata: input.metadata ?? {},
      ...(input.split
        ? {
            subaccount: input.split.subaccount,
            transaction_charge: toSubunits(input.split.driverushShareKes),
            bearer: "subaccount",
          }
        : {}),
    },
  });
}

const verifyData = z.object({
  reference: z.string(),
  status: z.string(),
  amount: z.number(),
  currency: z.string(),
  fees: z.number().nullable().optional(),
  paid_at: z.string().nullable().optional(),
  channel: z.string().nullable().optional(),
  customer: z.object({ email: z.string() }).partial().optional(),
});

export type VerifiedTransaction = {
  reference: string;
  /** Paystack's word: "success", "failed", "abandoned", "ongoing", "pending"… */
  status: string;
  succeeded: boolean;
  amountKes: number;
  feeKes: number;
  currency: string;
  channel: string | null;
  raw: z.infer<typeof verifyData>;
};

/** Ask Paystack how a payment ended. Never trust a webhook body or a return URL alone. */
export async function verifyTransaction(
  secretKey: string,
  reference: string,
  fetchFn?: Fetch,
): Promise<VerifiedTransaction> {
  const data = await call(
    secretKey,
    `/transaction/verify/${encodeURIComponent(reference)}`,
    verifyData,
    { fetch: fetchFn },
  );
  return {
    reference: data.reference,
    status: data.status,
    succeeded: data.status === "success" && data.currency === "KES",
    amountKes: fromSubunits(data.amount),
    feeKes: fromSubunits(data.fees ?? 0),
    currency: data.currency,
    channel: data.channel ?? null,
    raw: data,
  };
}

const bankData = z.array(
  z.object({
    name: z.string(),
    code: z.string(),
    type: z.string().nullable().optional(),
    active: z.boolean().optional(),
  }),
);

export type KenyanBank = { name: string; code: string };

/** Banks a school's share can settle to (Kenya cannot resolve account numbers: confirm with the school). */
export async function listKenyanBanks(
  secretKey: string,
  fetchFn?: Fetch,
): Promise<KenyanBank[]> {
  const banks = await call(
    secretKey,
    "/bank?country=kenya&currency=KES",
    bankData,
    { fetch: fetchFn },
  );
  return banks
    .filter((b) => b.active !== false && b.type !== "mobile_money")
    .map((b) => ({ name: b.name, code: b.code }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

const subaccountData = z.object({
  subaccount_code: z.string(),
  business_name: z.string(),
  account_number: z.string(),
  settlement_bank: z.string(),
});

/**
 * A school's subaccount. `percentage_charge` is 0 because every school pass
 * sends DriveRush's flat share as `transaction_charge`, which overrides it.
 */
export function createSubaccount(
  secretKey: string,
  input: { businessName: string; bankCode: string; accountNumber: string },
  fetchFn?: Fetch,
) {
  return call(secretKey, "/subaccount", subaccountData, {
    method: "POST",
    fetch: fetchFn,
    body: {
      business_name: input.businessName,
      settlement_bank: input.bankCode,
      account_number: input.accountNumber,
      percentage_charge: 0,
    },
  });
}

/**
 * Switches a school's old subaccount off, so a replaced or turned-down bank
 * can never be paid by mistake. Paystack keeps it for its records.
 */
export function deactivateSubaccount(
  secretKey: string,
  subaccountCode: string,
  fetchFn?: Fetch,
) {
  return call(
    secretKey,
    `/subaccount/${encodeURIComponent(subaccountCode)}`,
    z.unknown(),
    { method: "PUT", fetch: fetchFn, body: { active: false } },
  );
}

function sameHex(expected: string, given: string): boolean {
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(given, "hex");
  return a.length > 0 && a.length === b.length && timingSafeEqual(a, b);
}

function hmac512(key: string, payload: string): string {
  return createHmac("sha512", key).update(payload).digest("hex");
}

export type SignatureCheck =
  | { ok: true; scheme: "v1" | "legacy" }
  | { ok: false; reason: "missing" | "stale" | "mismatch" };

/**
 * Check a webhook really came from Paystack, over the RAW body (read it with
 * `request.text()` before any JSON parsing).
 *
 * - `Paystack-Signature: t=<unix>,v1=<key id>:<hex>[,v1=…]`: HMAC-SHA512 of
 *   `<t>.<raw body>` keyed with the whsec_ secret, at most 5 minutes old.
 * - `x-paystack-signature: <hex>`: HMAC-SHA512 of the raw body keyed with the
 *   secret key (Paystack's older scheme, no timestamp).
 */
export function verifySignature(
  rawBody: string,
  headers: Headers,
  keys: { secretKey: string; webhookSecret: string | null },
  nowS: number = Math.floor(Date.now() / 1000),
): SignatureCheck {
  const timestamped = headers.get("paystack-signature");
  if (timestamped && keys.webhookSecret) {
    let t: number | null = null;
    const sigs: string[] = [];
    for (const part of timestamped.split(",")) {
      const [k, ...rest] = part.trim().split("=");
      const value = rest.join("=");
      if (k === "t") t = Number(value);
      if (k === "v1") sigs.push(value.slice(value.lastIndexOf(":") + 1));
    }
    if (t === null || !Number.isFinite(t) || sigs.length === 0) {
      return { ok: false, reason: "missing" };
    }
    if (Math.abs(nowS - t) > SIGNATURE_MAX_AGE_S) {
      return { ok: false, reason: "stale" };
    }
    const expected = hmac512(keys.webhookSecret, `${t}.${rawBody}`);
    return sigs.some((s) => sameHex(expected, s))
      ? { ok: true, scheme: "v1" }
      : { ok: false, reason: "mismatch" };
  }

  const legacy = headers.get("x-paystack-signature");
  if (!legacy) return { ok: false, reason: "missing" };
  return sameHex(hmac512(keys.secretKey, rawBody), legacy)
    ? { ok: true, scheme: "legacy" }
    : { ok: false, reason: "mismatch" };
}
