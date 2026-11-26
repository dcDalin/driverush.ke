/**
 * The school's passes (owner, 2026-11-26): the code its learners pay
 * through and the link to hand out, the price the owner sets (at least
 * DriveRush's share plus a little, no ceiling), the bank its share goes to
 * (the owner sends it, DriveRush checks it), and what the school earned.
 * Paystack pays the school's share to its bank itself, two working days after
 * each payment, less Paystack's fee, so there is no balance to withdraw.
 */
import * as React from "react";
import { HoneypotInputs } from "remix-utils/honeypot/react";

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
import { InputField, ServerFormProvider } from "~/components/ui/forms/server";
import {
  type EarningRow,
  earningsTotals,
  type SchoolPassInfo,
} from "~/database/billing/school";
import { useServerForm } from "~/lib/forms/use-server-form";
import { SITE } from "~/lib/site";
import { RequestBankSchema, SetPassPriceSchema } from "~/schemas/billing";

import { BankFields } from "./bank-fields";

export function PassPanel({
  schoolName,
  info,
  canManage,
  paymentsOn,
  banks,
}: {
  schoolName: string;
  info: SchoolPassInfo | null;
  canManage: boolean;
  paymentsOn: boolean;
  banks: { name: string; code: string }[];
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
              first 16 levels free, and your code below starts working on the
              day passes open.
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
            <PriceForm
              key={info.price_kes}
              price={info.price_kes}
              share={info.driverush_share_kes}
              min={info.min_price_kes}
            />
          ) : null}
        </div>
      ) : !canManage ? (
        <p className="m-0 rounded-lg border border-line bg-surface p-4 text-[14px] text-ink-2">
          {schoolName} does not take payments yet. Your school's owner adds the
          school's bank, then learners can pay through you.
        </p>
      ) : null}
      {canManage ? (
        <BankCard info={info} banks={banks} paymentsOn={paymentsOn} />
      ) : null}
    </section>
  );
}

function BankCard({
  info,
  banks,
  paymentsOn,
}: {
  info: SchoolPassInfo | null;
  banks: { name: string; code: string }[];
  paymentsOn: boolean;
}) {
  const [changing, setChanging] = React.useState(false);
  const live = info?.ready ? info.bank_label : null;
  const waiting = info?.pending_bank_label ?? null;
  const showForm = !waiting && (!live || changing);
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
        {!paymentsOn ? null : showForm ? (
          banks.length === 0 ? (
            <p className="m-0 text-[14px] text-ink-3">
              The bank list did not load. Reload to try again.
            </p>
          ) : (
            <BankForm
              onDone={() => setChanging(false)}
              banks={banks}
              replacing={Boolean(live)}
            />
          )
        ) : live && !waiting ? (
          <Button
            type="button"
            variant="paper"
            size="sm"
            className="self-start"
            onClick={() => setChanging(true)}
          >
            Change bank
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

function BankForm({
  banks,
  replacing,
  onDone,
}: {
  banks: { name: string; code: string }[];
  replacing: boolean;
  onDone: () => void;
}) {
  const form = useServerForm({
    schema: RequestBankSchema,
    key: "request-bank",
    resetOnSuccess: true,
    defaultValues: {
      intent: "request-bank" as const,
      bankCode: "",
      accountNumber: "",
      accountName: "",
    },
  });
  React.useEffect(() => {
    if (form.fetcher.state === "idle" && form.fetcher.data?.ok) onDone();
  }, [form.fetcher.state, form.fetcher.data, onDone]);
  return (
    <ServerFormProvider methods={form.methods}>
      <form.fetcher.Form
        ref={form.formRef}
        method="post"
        onSubmit={form.methods.handleSubmit}
        noValidate
        className="flex flex-col gap-3"
      >
        <HoneypotInputs />
        <BankFields banks={banks} disabled={form.busy} />
        <Button
          type="submit"
          variant="rush"
          className="self-start"
          isLoading={form.busy}
        >
          {replacing ? "Send the new bank" : "Send to DriveRush"}
        </Button>
      </form.fetcher.Form>
    </ServerFormProvider>
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

function PriceForm({
  price,
  share,
  min,
}: {
  price: number;
  share: number;
  min: number;
}) {
  const { methods, fetcher, formRef, busy } = useServerForm({
    schema: SetPassPriceSchema,
    key: "set-pass-price",
    defaultValues: { intent: "set-pass-price" as const, priceKes: price },
  });
  const typed = Number(methods.watch("priceKes"));
  const earns = Number.isFinite(typed) && typed >= min ? typed - share : null;
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
            earns !== null
              ? `You earn ${kes(earns)} per learner, less Paystack's fee. At least ${kes(min)}.`
              : `At least ${kes(min)}: DriveRush keeps ${kes(share)}.`
          }
          className="sm:w-72"
          disabled={busy}
          inputProps={{
            type: "number",
            inputMode: "numeric",
            min,
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
