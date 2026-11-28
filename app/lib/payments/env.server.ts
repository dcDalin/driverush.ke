/**
 * Paystack settings, server only. The secret key moves money and reads every
 * payment, so it never goes in a VITE_ variable or code that reaches the
 * browser. Without it, payments are off: the pass pages say so and nothing
 * calls Paystack (the same way a build without Supabase has accounts off).
 *
 * PAYSTACK_SECRET_KEY      sk_test_… locally and in previews, sk_live_… in
 *                          Vercel Production only.
 * PAYSTACK_WEBHOOK_SECRET  whsec_… from Developers > API configuration, for
 *                          the timestamped `Paystack-Signature` header.
 *                          Optional: without it the webhook checks the older
 *                          `x-paystack-signature`, signed with the secret key.
 */
import { z } from "zod";

const paystackEnvSchema = z.object({
  PAYSTACK_SECRET_KEY: z
    .string()
    .regex(/^sk_(test|live)_\w+$/, "PAYSTACK_SECRET_KEY must be an sk_ key")
    .optional(),
  PAYSTACK_WEBHOOK_SECRET: z
    .string()
    .regex(/^whsec_\w+$/, "PAYSTACK_WEBHOOK_SECRET must be a whsec_ secret")
    .optional(),
});

export type PaystackEnv = {
  secretKey: string;
  webhookSecret: string | null;
  live: boolean;
};

let cached: z.infer<typeof paystackEnvSchema> | null = null;

function read(source: Record<string, string | undefined>) {
  if (source !== process.env) return paystackEnvSchema.parse(source);
  if (!cached) cached = paystackEnvSchema.parse(source);
  return cached;
}

/** Whether this server can take payments at all. */
export function paymentsEnabled(
  source: Record<string, string | undefined> = process.env,
): boolean {
  return Boolean(read(source).PAYSTACK_SECRET_KEY);
}

/** The Paystack keys; throws when payments are off, so check `paymentsEnabled` first. */
export function getPaystackEnv(
  source: Record<string, string | undefined> = process.env,
): PaystackEnv {
  const env = read(source);
  if (!env.PAYSTACK_SECRET_KEY) {
    throw new Error("Payments are off: PAYSTACK_SECRET_KEY is not set.");
  }
  return {
    secretKey: env.PAYSTACK_SECRET_KEY,
    webhookSecret: env.PAYSTACK_WEBHOOK_SECRET ?? null,
    live: env.PAYSTACK_SECRET_KEY.startsWith("sk_live_"),
  };
}
