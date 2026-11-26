/**
 * Who gets told what, after a change is saved. Each sends one email through
 * `sendEmail` (never throws) and is awaited by the action, so a test or a
 * local run sees it land in Mailpit before the toast.
 */
import {
  adminEmail,
  bankDecisionEmail,
  bankRequestedEmail,
  ownerEmail,
  studentEmail,
} from "./messages";
import { sendEmail } from "./send.server";

/** The site the action ran on, so links open the same app. */
export function originOf(request: Request) {
  return new URL(request.url).origin;
}

export function tellOwner(to: string, input: Parameters<typeof ownerEmail>[0]) {
  return sendEmail({ to, ...ownerEmail(input) });
}

export function tellAdmin(to: string, input: Parameters<typeof adminEmail>[0]) {
  return sendEmail({ to, ...adminEmail(input) });
}

export function tellStudent(
  to: string,
  input: Parameters<typeof studentEmail>[0],
) {
  return sendEmail({ to, ...studentEmail(input) });
}

export function tellBankDecision(
  to: string,
  input: Parameters<typeof bankDecisionEmail>[0],
) {
  return sendEmail({ to, ...bankDecisionEmail(input) });
}

/** To DriveRush (STAFF_ALERT_EMAIL), when an owner sends bank details. */
export async function tellStaffBankRequested(
  input: Parameters<typeof bankRequestedEmail>[0],
) {
  const to = process.env.STAFF_ALERT_EMAIL;
  if (!to) return { sent: false, via: "none" as const };
  return sendEmail({ to, ...bankRequestedEmail(input) });
}
