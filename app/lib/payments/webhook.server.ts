/**
 * Paystack's webhook, read safely: the signature is checked over the raw body
 * before anything is parsed, so the route's first line is this gate (as an
 * account route's is `requireUser`). See `app/lib/auth/gate-first.test.ts`.
 */
import { getPaystackEnv, paymentsEnabled } from "./env.server";
import { verifySignature } from "./paystack.server";

export type PaystackEvent = {
  event: string;
  data: Record<string, unknown>;
};

export type SignedEvent =
  { ok: true; event: PaystackEvent } | { ok: false; status: 401 | 400 | 503 };

/** The webhook's event, only if Paystack signed it. */
export async function readSignedPaystackEvent(
  request: Request,
): Promise<SignedEvent> {
  if (!paymentsEnabled()) return { ok: false, status: 503 };
  const raw = await request.text();
  const check = verifySignature(raw, request.headers, getPaystackEnv());
  if (!check.ok) return { ok: false, status: 401 };
  try {
    const body = JSON.parse(raw) as Partial<PaystackEvent>;
    if (typeof body.event !== "string" || typeof body.data !== "object") {
      return { ok: false, status: 400 };
    }
    return {
      ok: true,
      event: { event: body.event, data: body.data ?? {} },
    };
  } catch {
    return { ok: false, status: 400 };
  }
}

/** Our references start dr_; anything else on the account is not ours. */
export function ourReference(value: unknown): string | null {
  return typeof value === "string" && /^dr_[A-Za-z0-9_]+$/.test(value)
    ? value
    : null;
}

/** The transaction a refund event is about. */
export function refundReference(data: Record<string, unknown>) {
  const transaction = data.transaction as { reference?: unknown } | undefined;
  return (
    ourReference(data.transaction_reference) ??
    ourReference(transaction?.reference)
  );
}
