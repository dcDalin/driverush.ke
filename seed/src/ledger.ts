/**
 * Accounts the seed makes, and the rows of the table it prints at the end.
 * Accounts are made through the auth admin API (as thinkrush does), confirmed,
 * with the demo password, so the database's own sign-up trigger runs: the
 * profile row and the matching of school invites happen as they would for
 * a real sign-up.
 */
import { DEMO_PASSWORD, serviceClient } from "./local";

export type SummaryRow = {
  email: string;
  who: string;
  where: string;
  state: string;
};

const accounts = new Map<string, string>();
export const summary: SummaryRow[] = [];

export function note(row: SummaryRow) {
  summary.push(row);
}

/** The account's id, made now if this run has not made it yet. */
export async function account(
  email: string,
  name: string,
  password = DEMO_PASSWORD,
) {
  const known = accounts.get(email);
  if (known) return known;
  const { data, error } = await serviceClient().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: name },
  });
  if (error || !data.user) {
    throw new Error(`Creating ${email} failed: ${error?.message ?? "no user"}`);
  }
  accounts.set(email, data.user.id);
  return data.user.id;
}

/** Records accounts that already exist (the SQL fixture's). */
export function knownAccount(email: string, id: string) {
  accounts.set(email, id);
}
