/**
 * POST /api/webhooks/paystack: Paystack tells us a payment ended.
 *
 * No session: the gate is Paystack's signature over the raw body. Then we
 * never trust the body for the outcome: `confirmPayment` asks Paystack again
 * and settles or fails the payment (idempotent, so a retry or the learner's
 * return page arriving first changes nothing). A refund done in the Paystack
 * dashboard stops the pass.
 *
 * Answers 200 once the event is handled or not ours, 401 on a bad signature,
 * and 500 when our side failed, so Paystack tries again (every 3 minutes,
 * then hourly for 72 hours).
 */
import { refundPayment } from "~/database/billing/settle.server";
import { confirmPayment } from "~/lib/payments/pass-flow.server";
import {
  ourReference,
  readSignedPaystackEvent,
  refundReference,
} from "~/lib/payments/webhook.server";

import type { Route } from "./+types/webhooks.paystack";

const NOT_OURS = "We could not find that.";

export async function action({ request }: Route.ActionArgs) {
  const signed = await readSignedPaystackEvent(request);
  if (!signed.ok) return new Response(null, { status: signed.status });
  const { event, data } = signed.event;

  if (event === "charge.success") {
    const reference = ourReference(data.reference);
    if (!reference) return new Response(null, { status: 200 });
    const confirmed = await confirmPayment(reference);
    if (confirmed.outcome === "problem" && confirmed.message !== NOT_OURS) {
      // Paid, but our side refused (an amount mismatch, say): keep it in the
      // logs for staff, and do not ask Paystack to send it again.
      console.error("paystack webhook: settle refused", reference, confirmed);
    }
    return new Response(null, { status: 200 });
  }

  if (event === "refund.processed") {
    const reference = refundReference(data);
    if (!reference) return new Response(null, { status: 200 });
    const refunded = await refundPayment(reference, data as never);
    if (refunded.error && refunded.error !== NOT_OURS) {
      return new Response(null, { status: 500 });
    }
    return new Response(null, { status: 200 });
  }

  return new Response(null, { status: 200 });
}
