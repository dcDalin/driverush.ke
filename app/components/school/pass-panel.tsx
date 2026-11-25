/**
 * The school's passes (owner, 2026-11-25): the code its learners pay
 * through, the link to hand out, the price the owner sets, and what the
 * school earned. Paystack pays the school's share to its bank itself, two
 * working days after each payment, so there is no balance to withdraw.
 */
import * as React from "react";
import { HoneypotInputs } from "remix-utils/honeypot/react";

import { kes } from "~/components/account/pass-offers";
import { Icon } from "~/components/brand/icon";
import { CheckIcon, CopyIcon, WhatsappIcon } from "~/components/brand/icons";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { InputField, ServerFormProvider } from "~/components/ui/forms/server";
import {
  type EarningRow,
  earningsTotals,
  type SchoolPassInfo,
} from "~/database/billing/school";
import { useServerForm } from "~/lib/forms/use-server-form";
import { SITE } from "~/lib/site";
import { SetPassPriceSchema } from "~/schemas/billing";

export function PassPanel({
  schoolName,
  info,
  canManage,
}: {
  schoolName: string;
  info: SchoolPassInfo | null;
  canManage: boolean;
}) {
  return (
    <section id="passes" className="flex flex-col gap-4">
      <h2 className="font-display text-[20px] font-bold">Passes</h2>
      {!info || !info.ready ? (
        <p className="m-0 rounded-lg border border-line bg-surface p-4 text-[14px] text-ink-2">
          Payments are not set up for {schoolName} yet. DriveRush sets them up
          with your bank details, then your learners can pay through you and you
          earn from each one.
        </p>
      ) : (
        <div className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-4">
          <CodeAndLink code={info.code} schoolName={schoolName} />
          <p className="m-0 text-[14px] text-ink-2">
            Learners pay {kes(info.price_kes)} for 60 days of the full course.
            You earn{" "}
            <strong className="text-ink">
              {kes(info.price_kes - info.driverush_share_kes)}
            </strong>{" "}
            from each one; DriveRush keeps {kes(info.driverush_share_kes)}.
            {info.bank_label ? ` Paid to ${info.bank_label}.` : ""}
          </p>
          {canManage && (
            <PriceForm
              key={info.price_kes}
              price={info.price_kes}
              share={info.driverush_share_kes}
            />
          )}
        </div>
      )}
    </section>
  );
}

function CodeAndLink({
  code,
  schoolName,
}: {
  code: string;
  schoolName: string;
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
    </div>
  );
}

function PriceForm({ price, share }: { price: number; share: number }) {
  const { methods, fetcher, formRef, busy } = useServerForm({
    schema: SetPassPriceSchema,
    key: "set-pass-price",
    defaultValues: { intent: "set-pass-price" as const, priceKes: price },
  });
  const typed = Number(methods.watch("priceKes"));
  const earns = Number.isFinite(typed) ? typed - share : null;
  return (
    <ServerFormProvider methods={methods}>
      <fetcher.Form
        ref={formRef}
        method="post"
        onSubmit={methods.handleSubmit}
        noValidate
        className="flex flex-col gap-3 sm:flex-row sm:items-start"
      >
        <HoneypotInputs />
        <InputField
          name="priceKes"
          label="Price for your learners (KES)"
          description={
            earns !== null && earns > 0
              ? `You earn ${kes(earns)} per learner. KES 500 to 1,000.`
              : "KES 500 to 1,000."
          }
          className="sm:w-64"
          disabled={busy}
          inputProps={{
            type: "number",
            inputMode: "numeric",
            min: 500,
            max: 1000,
            step: 1,
          }}
        />
        <Button
          type="submit"
          size="sm"
          variant="paper"
          isLoading={busy}
          className="sm:mt-6"
        >
          Save price
        </Button>
      </fetcher.Form>
    </ServerFormProvider>
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
        Paystack pays your share to your bank two working days after each
        payment.
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
