/**
 * DriveRush's own emails (owner, 2026-11-26): invites, hand-overs, "you've
 * been added", bank decisions. Sign-in codes stay with Supabase Auth.
 *
 *   RESEND_API_KEY  re_… : sent through Resend (production, previews).
 *   MAILPIT_URL     http://127.0.0.1:54724 : the local stack's Mailpit, so
 *                   local emails land beside the sign-in codes.
 *   neither         nothing is sent; the server logs one line.
 *   EMAIL_FROM      the sender, on a domain verified in Resend
 *                   (default "DriveRush <hello@driverush.ke>").
 *
 * Sending never fails the action that asked for it: the change is already
 * saved, so a bounced email is logged and the toast still says it worked.
 * The person can also find everything in the app.
 */
import { z } from "zod";

const emailEnvSchema = z.object({
  RESEND_API_KEY: z
    .string()
    .regex(/^re_\w+$/, "RESEND_API_KEY must be a re_ key")
    .optional(),
  MAILPIT_URL: z.url().optional(),
  EMAIL_FROM: z.string().min(3).optional(),
});

export type Email = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

type Fetch = typeof fetch;

const DEFAULT_FROM = "DriveRush <hello@driverush.ke>";

function splitFrom(from: string) {
  const match = /^(.*)<([^>]+)>\s*$/.exec(from);
  return match
    ? { name: match[1]!.trim(), email: match[2]!.trim() }
    : { name: "", email: from.trim() };
}

export type SendResult = { sent: boolean; via: "resend" | "mailpit" | "none" };

/** Sends one email. Never throws: it says whether it went. */
export async function sendEmail(
  email: Email,
  {
    source = process.env,
    fetchFn = fetch,
  }: { source?: Record<string, string | undefined>; fetchFn?: Fetch } = {},
): Promise<SendResult> {
  const parsed = emailEnvSchema.safeParse(source);
  const env = parsed.success ? parsed.data : {};
  const from = env.EMAIL_FROM ?? DEFAULT_FROM;
  try {
    if (env.RESEND_API_KEY) {
      const res = await fetchFn("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [email.to],
          subject: email.subject,
          text: email.text,
          html: email.html,
        }),
      });
      if (!res.ok) throw new Error(`Resend answered ${res.status}`);
      return { sent: true, via: "resend" };
    }
    if (env.MAILPIT_URL) {
      const sender = splitFrom(from);
      const res = await fetchFn(
        new URL("/api/v1/send", env.MAILPIT_URL).toString(),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            From: { Email: sender.email, Name: sender.name },
            To: [{ Email: email.to }],
            Subject: email.subject,
            Text: email.text,
            HTML: email.html,
          }),
        },
      );
      if (!res.ok) throw new Error(`Mailpit answered ${res.status}`);
      return { sent: true, via: "mailpit" };
    }
    console.info(`[email] not sent (no RESEND_API_KEY): ${email.subject}`);
    return { sent: false, via: "none" };
  } catch (error) {
    console.error(
      `[email] failed: ${email.subject}:`,
      error instanceof Error ? error.message : error,
    );
    return { sent: false, via: env.RESEND_API_KEY ? "resend" : "mailpit" };
  }
}
