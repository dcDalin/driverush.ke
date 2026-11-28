/**
 * The school's passes (owner, 2026-11-26): the code its learners pay
 * through and the link to hand out, the price the owner sets (at least
 * DriveRush's share plus a little, no ceiling), the bank its share goes to
 * (the owner sends it, DriveRush checks it), and what the school earned.
 * Paystack pays the school's share to its bank itself, two working days after
 * each payment, less Paystack's fee, so there is no balance to withdraw.
 *
 * The page shows and links; the price and the bank are changed in their own
 * modal routes (`passes/price`, `passes/bank`).
 */
import * as React from "react";
import { Link } from "react-router";

import { kes } from "~/components/account/pass-offers";
import { Icon } from "~/components/brand/icon";
import { CheckIcon, CopyIcon, WhatsappIcon } from "~/components/brand/icons";
import {
  Alert,
  AlertBody,
  AlertDescription,
  AlertTitle,
} from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  type EarningRow,
  earningsTotals,
  type SchoolPassInfo,
} from "~/database/billing/school";
import { schoolPath } from "~/lib/school/nav";
import { SITE } from "~/lib/site";

export function PassPanel({
  schoolId,
  schoolName,
  info,
  canManage,
  paymentsOn,
}: {
  schoolId: string;
  schoolName: string;
  info: SchoolPassInfo | null;
  canManage: boolean;
  paymentsOn: boolean;
}) {
  const ready = Boolean(info?.ready);
  return (
    <section id="passes" className="flex flex-col gap-4">
      {!paymentsOn ? (
        <Alert>
          <AlertBody>
            <AlertTitle>Passes are not on sale yet</AlertTitle>
            <AlertDescription>
              DriveRush opens passes soon. Until then every learner gets the
              first 16 levels free.{" "}
              {ready
                ? "Your code below starts working on the day passes open."
                : "You can add your bank and get your code once they open."}
            </AlertDescription>
          </AlertBody>
        </Alert>
      ) : null}
      {info && ready ? (
        <div className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-4">
          <CodeAndLink
            code={info.code}
            schoolName={schoolName}
            shareable={paymentsOn}
          />
          <p className="m-0 text-[14px] text-ink-2">
            Learners pay {kes(info.price_kes)} for 60 days of the full course.
            You earn{" "}
            <strong className="text-ink">
              {kes(info.price_kes - info.driverush_share_kes)}
            </strong>{" "}
            from each one, less Paystack's fee; DriveRush keeps{" "}
            {kes(info.driverush_share_kes)}.
          </p>
          {canManage ? (
            <Button asChild size="sm" variant="paper" className="self-start">
              <Link
                to={schoolPath(schoolId, "passes/price")}
                preventScrollReset
              >
                Change price
              </Link>
            </Button>
          ) : null}
        </div>
      ) : !canManage ? (
        <p className="m-0 rounded-lg border border-line bg-surface p-4 text-[14px] text-ink-2">
          {schoolName} does not take payments yet. Your school's owner adds the
          school's bank, then learners can pay through you.
        </p>
      ) : null}
      {canManage ? (
        <BankCard schoolId={schoolId} info={info} paymentsOn={paymentsOn} />
      ) : null}
    </section>
  );
}

function BankCard({
  schoolId,
  info,
  paymentsOn,
}: {
  schoolId: string;
  info: SchoolPassInfo | null;
  paymentsOn: boolean;
}) {
  const live = info?.ready ? info.bank_label : null;
  const waiting = info?.pending_bank_label ?? null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          Your bank
          {live ? <Badge variant="green">getting paid</Badge> : null}
          {waiting ? (
            <Badge variant="amber">DriveRush is checking</Badge>
          ) : null}
        </CardTitle>
        <CardDescription>
          Paystack pays your share of every pass here, two working days after
          each payment. The details stay with Paystack; we keep only the bank
          and the last four digits.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {live ? (
          <p className="m-0 text-[14px]">
            Paid to <strong>{live}</strong>
            {info?.account_name ? ` (${info.account_name})` : ""}.
          </p>
        ) : null}
        {waiting ? (
          <p className="m-0 text-[14px] text-ink-2">
            You sent <strong>{waiting}</strong>
            {info?.pending_account_name
              ? ` (${info.pending_account_name})`
              : ""}
            . DriveRush calls you to check it against your bank letter, then it
            goes live.{live ? ` Until then, ${live} keeps being paid.` : ""}
          </p>
        ) : null}
        {info?.review_note && !waiting ? (
          <Alert>
            <AlertBody>
              <AlertTitle>
                DriveRush could not approve your last bank
              </AlertTitle>
              <AlertDescription>{info.review_note}</AlertDescription>
            </AlertBody>
          </Alert>
        ) : null}
        {paymentsOn && !waiting ? (
          <Button
            asChild
            variant={live ? "paper" : "rush"}
            size={live ? "sm" : "default"}
            className="self-start"
          >
            <Link to={schoolPath(schoolId, "passes/bank")} preventScrollReset>
              {live ? "Change bank" : "Add your bank"}
            </Link>
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

function CodeAndLink({
  code,
  schoolName,
  shareable,
}: {
  code: string;
  schoolName: string;
  shareable: boolean;
}) {
  const link = `${SITE.url}/pass?code=${code}`;
  const [copied, setCopied] = React.useState(false);
  const say = `Get the DriveRush Model Town Board course through ${schoolName}: ${link}`;
  return (
    <div className="flex flex-col gap-2">
      <p className="m-0 text-[13px] font-semibold text-ink-2">
        Your code{" "}
        <Badge variant="ink" className="ml-1 font-mono tracking-widest">
          {code}
        </Badge>
      </p>
      <p className="m-0 font-mono text-[13px] break-all text-ink-2">{link}</p>
      {shareable ? (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="paper"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(link);
                setCopied(true);
                window.setTimeout(() => setCopied(false), 2000);
              } catch {
                // No clipboard (an old browser): the link is on screen to copy.
              }
            }}
          >
            <Icon icon={copied ? CheckIcon : CopyIcon} size={16} />
            {copied ? "Copied" : "Copy link"}
          </Button>
          <Button asChild size="sm" variant="paper">
            <a
              href={`https://wa.me/?text=${encodeURIComponent(say)}`}
              target="_blank"
              rel="noreferrer"
            >
              <Icon icon={WhatsappIcon} size={16} />
              Share on WhatsApp
            </a>
          </Button>
        </div>
      ) : null}
    </div>
  );
}

const daySaid = (iso: string) =>
  new Intl.DateTimeFormat("en-KE", {
    timeZone: "Africa/Nairobi",
    day: "numeric",
    month: "short",
  }).format(new Date(iso));

export function EarningsPanel({
  rows,
  ready,
}: {
  rows: EarningRow[];
  ready: boolean;
}) {
  if (!ready && rows.length === 0) return null;
  const totals = earningsTotals(rows);
  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-display text-[20px] font-bold">Earnings</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <Total
          label="This month"
          kesEarned={totals.thisMonth.kes}
          learners={totals.thisMonth.learners}
        />
        <Total
          label="Last month"
          kesEarned={totals.lastMonth.kes}
          learners={totals.lastMonth.learners}
        />
      </div>
      <p className="m-0 text-[13px] text-ink-3">
        Paystack pays your share, less its fee, to your bank two working days
        after each payment.
      </p>
      {rows.length === 0 ? (
        <p className="m-0 text-[14px] text-ink-3">
          No learner has paid through you yet. Share your link with this week's
          class.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-line rounded-lg border border-line bg-surface">
          {rows.slice(0, 50).map((r) => (
            <li
              key={r.payment_id}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-[14px]"
            >
              <span className="w-16 shrink-0 text-ink-3">
                {daySaid(r.paid_at)}
              </span>
              <span className="min-w-0 flex-1 truncate">
                {r.learner_email ?? "Deleted account"}
              </span>
              {r.branch_name && (
                <span className="text-ink-3">{r.branch_name}</span>
              )}
              {r.status === "refunded" ? (
                <Badge variant="amber">Refunded</Badge>
              ) : (
                <span className="font-semibold">{kes(r.school_share_kes)}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Total({
  label,
  kesEarned,
  learners,
}: {
  label: string;
  kesEarned: number;
  learners: number;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-line bg-surface p-4">
      <span className="text-[13px] text-ink-3">{label}</span>
      <span className="font-display text-[24px] font-bold">
        {kes(kesEarned)}
      </span>
      <span className="text-[13px] text-ink-3">
        {learners} {learners === 1 ? "learner" : "learners"}
      </span>
    </div>
  );
}
