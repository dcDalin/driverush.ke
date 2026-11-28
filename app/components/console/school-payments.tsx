/**
 * One school's payments in the console (owner, 2026-11-26), as a page that
 * shows and links, with each change in its own modal route:
 *
 *   - whether it takes payments, its code and price, and the bank it is paid
 *     to, with "Change code" and "Set the bank yourself";
 *   - a bank its owner sent, waiting: staff call the school, check it against
 *     the bank letter (Paystack cannot check a Kenyan account number), then
 *     approve it or turn it down with a reason the owner reads;
 *   - what it earned.
 */
import { Link } from "react-router";

import { kes } from "~/components/account/pass-offers";
import { StreamedEarnings } from "~/components/school/pass-panel";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import type { EarningRow, SchoolPassInfo } from "~/database/billing/school";
import { useConsoleSchoolPath } from "~/lib/console/use-console-school";

const WHEN = new Intl.DateTimeFormat("en-KE", {
  timeZone: "Africa/Nairobi",
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});

export function SchoolPaymentsBlock({
  schoolId,
  payments,
  earnings,
  paymentsOn,
}: {
  schoolId: string;
  payments: SchoolPassInfo | null;
  earnings: Promise<EarningRow[]>;
  paymentsOn: boolean;
}) {
  const consoleSchoolPath = useConsoleSchoolPath();
  const to = (page: string) => consoleSchoolPath(schoolId, page);
  const live = Boolean(payments?.ready);
  return (
    <div className="flex flex-col gap-4">
      {payments?.pending_bank_label ? (
        <BankReview schoolId={schoolId} payments={payments} />
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            Paying through this school
            {live ? (
              <Badge variant="green">taking payments</Badge>
            ) : (
              <Badge variant="outline">not taking payments</Badge>
            )}
          </CardTitle>
          <CardDescription>
            {live
              ? "Learners pay with the school's code; its share goes to its bank."
              : payments?.pending_bank_label
                ? "Its owner sent a bank: check it above."
                : "Its owner has not sent a bank yet. Its learners can only buy their own pass."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <dl className="m-0 grid gap-x-6 gap-y-1 text-[14px] sm:grid-cols-[auto_1fr]">
            <dt className="text-ink-3">Code</dt>
            <dd className="m-0 font-mono font-semibold">
              {payments?.code ?? "None yet"}
            </dd>
            <dt className="text-ink-3">Price</dt>
            <dd className="m-0">
              {payments ? kes(payments.price_kes) : "Not set"}
            </dd>
            <dt className="text-ink-3">Paid to</dt>
            <dd className="m-0">
              {payments?.bank_label
                ? `${payments.bank_label}${payments.account_name ? ` (${payments.account_name})` : ""}`
                : "No bank yet"}
            </dd>
          </dl>
          {/* No empty row (and its gap) when there is nothing to press. */}
          <div className="flex flex-wrap gap-2 empty:hidden">
            {payments ? (
              <Button asChild size="sm" variant="paper">
                <Link to={to("payments/code")} preventScrollReset>
                  Change code
                </Link>
              </Button>
            ) : null}
            {paymentsOn ? (
              <Button asChild size="sm" variant="paper">
                <Link to={to("payments/bank")} preventScrollReset>
                  {live ? "Change the bank yourself" : "Set the bank yourself"}
                </Link>
              </Button>
            ) : null}
          </div>
          {!paymentsOn ? (
            <p className="m-0 text-[13px] text-ink-3">
              Payments are off on this server (no PAYSTACK_SECRET_KEY): banks
              cannot be made or switched off here.
            </p>
          ) : null}
        </CardContent>
      </Card>
      <StreamedEarnings rows={earnings} ready={live} staff />
    </div>
  );
}

function BankReview({
  schoolId,
  payments,
}: {
  schoolId: string;
  payments: SchoolPassInfo;
}) {
  const consoleSchoolPath = useConsoleSchoolPath();
  const to = (decision: "approve" | "decline") =>
    consoleSchoolPath(schoolId, `payments/review/${decision}`);
  return (
    <Card className="border-warning-line">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          Bank waiting for you
          <Badge variant="amber">check it</Badge>
        </CardTitle>
        <CardDescription>
          Call the school and check this against their bank letter before
          approving: Paystack cannot check a Kenyan account number.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <dl className="m-0 grid gap-x-6 gap-y-1 text-[14px] sm:grid-cols-[auto_1fr]">
          <dt className="text-ink-3">Bank</dt>
          <dd className="m-0 font-semibold">{payments.pending_bank_label}</dd>
          <dt className="text-ink-3">Account name</dt>
          <dd className="m-0 font-semibold">
            {payments.pending_account_name ?? "Not given"}
          </dd>
          <dt className="text-ink-3">Sent</dt>
          <dd className="m-0">
            {payments.requested_at
              ? WHEN.format(new Date(payments.requested_at))
              : ""}
          </dd>
          {payments.bank_label ? (
            <>
              <dt className="text-ink-3">Replaces</dt>
              <dd className="m-0">{payments.bank_label}</dd>
            </>
          ) : null}
        </dl>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="rush">
            <Link to={to("approve")} preventScrollReset>
              Approve this bank
            </Link>
          </Button>
          <Button asChild variant="paper">
            <Link to={to("decline")} preventScrollReset>
              Turn it down
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
