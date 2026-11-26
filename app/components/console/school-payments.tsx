/**
 * One school's payments in the console (owner, 2026-11-26):
 *
 *   - whether it takes payments, its code and price, and the bank it is paid to;
 *   - a bank its owner sent, waiting: staff call the school, check it against
 *     the bank letter (Paystack cannot check a Kenyan account number), then
 *     approve it (it goes live, the old one is switched off) or turn it down
 *     with a reason the owner reads;
 *   - the code it hands out;
 *   - a bank staff set themselves, already checked, live at once;
 *   - what it earned.
 */
import { HoneypotInputs } from "remix-utils/honeypot/react";

import { kes } from "~/components/account/pass-offers";
import { Confirm } from "~/components/console/confirm";
import { BankFields } from "~/components/school/bank-fields";
import { EarningsPanel } from "~/components/school/pass-panel";
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/components/ui/collapsible";
import {
  InputField,
  ServerFormProvider,
  TextareaField,
} from "~/components/ui/forms/server";
import type { EarningRow, SchoolPassInfo } from "~/database/billing/school";
import { useServerForm } from "~/lib/forms/use-server-form";
import {
  ReviewBankSchema,
  SetPassCodeSchema,
  SetUpPaymentsSchema,
} from "~/schemas/billing";

const WHEN = new Intl.DateTimeFormat("en-KE", {
  timeZone: "Africa/Nairobi",
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});

export function SchoolPaymentsBlock({
  schoolId,
  schoolName,
  suggestedCode,
  payments,
  earnings,
  banks,
  paymentsOn,
}: {
  schoolId: string;
  schoolName: string;
  suggestedCode: string;
  payments: SchoolPassInfo | null;
  earnings: EarningRow[];
  banks: { name: string; code: string }[];
  paymentsOn: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      <Status payments={payments} paymentsOn={paymentsOn} />
      {payments?.pending_bank_label ? (
        <BankReview schoolId={schoolId} payments={payments} />
      ) : null}
      {payments ? <CodeForm schoolId={schoolId} code={payments.code} /> : null}
      <DirectBank
        schoolId={schoolId}
        schoolName={schoolName}
        code={payments?.code ?? suggestedCode}
        banks={banks}
        paymentsOn={paymentsOn}
        live={Boolean(payments?.ready)}
      />
      <EarningsPanel rows={earnings} ready={Boolean(payments?.ready)} />
    </div>
  );
}

function Status({
  payments,
  paymentsOn,
}: {
  payments: SchoolPassInfo | null;
  paymentsOn: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      {payments?.ready ? (
        <p className="m-0 flex flex-wrap items-center gap-2 text-[14px]">
          <Badge variant="green">taking payments</Badge>
          Code <span className="font-mono">{payments.code}</span> ·{" "}
          {kes(payments.price_kes)} · paid to {payments.bank_label}
          {payments.account_name ? ` (${payments.account_name})` : ""}
        </p>
      ) : (
        <p className="m-0 flex flex-wrap items-center gap-2 text-[14px] text-ink-2">
          <Badge variant="outline">not taking payments</Badge>
          {payments?.pending_bank_label
            ? "Its owner sent a bank: check it below."
            : "Its owner has not sent a bank yet. Its learners can only buy their own pass."}
        </p>
      )}
      {!paymentsOn ? (
        <p className="m-0 text-[13px] text-ink-3">
          Payments are off on this server (no PAYSTACK_SECRET_KEY): banks cannot
          be made or switched off here.
        </p>
      ) : null}
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
  const approve = useServerForm({
    schema: ReviewBankSchema,
    key: `review-bank:approve:${schoolId}`,
    defaultValues: {
      intent: "review-bank" as const,
      schoolId,
      decision: "approve" as const,
      note: "",
    },
  });
  const decline = useServerForm({
    schema: ReviewBankSchema,
    key: `review-bank:decline:${schoolId}`,
    resetOnSuccess: true,
    defaultValues: {
      intent: "review-bank" as const,
      schoolId,
      decision: "decline" as const,
      note: "",
    },
  });
  const busy = approve.busy || decline.busy;
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
        <dl className="m-0 grid gap-x-4 gap-y-1 text-[14px] sm:grid-cols-[auto_1fr]">
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
        <ServerFormProvider methods={approve.methods}>
          <approve.fetcher.Form
            ref={approve.formRef}
            method="post"
            onSubmit={approve.methods.handleSubmit}
            noValidate
          >
            <HoneypotInputs />
            <Confirm
              trigger={
                <Button
                  type="button"
                  variant="rush"
                  isLoading={approve.busy}
                  disabled={busy}
                >
                  Approve this bank
                </Button>
              }
              title="Approve this bank?"
              body={`From now on, the school's share of every pass bought through it goes to ${payments.pending_bank_label}${payments.bank_label ? `, not ${payments.bank_label}` : ""}.`}
              confirm="Approve"
              onConfirm={() => approve.formRef.current?.requestSubmit()}
            />
          </approve.fetcher.Form>
        </ServerFormProvider>
        <ServerFormProvider methods={decline.methods}>
          <decline.fetcher.Form
            ref={decline.formRef}
            method="post"
            onSubmit={decline.methods.handleSubmit}
            noValidate
            className="flex flex-col gap-2"
          >
            <HoneypotInputs />
            <TextareaField
              name="note"
              label="Or turn it down: why?"
              description="The owner reads this on their dashboard and by email."
              disabled={busy}
            />
            <Button
              type="submit"
              variant="paper"
              className="self-start"
              isLoading={decline.busy}
              disabled={busy}
            >
              Turn it down
            </Button>
          </decline.fetcher.Form>
        </ServerFormProvider>
      </CardContent>
    </Card>
  );
}

function CodeForm({ schoolId, code }: { schoolId: string; code: string }) {
  const form = useServerForm({
    schema: SetPassCodeSchema,
    key: `set-pass-code:${schoolId}`,
    defaultValues: { intent: "set-pass-code" as const, schoolId, code },
  });
  return (
    <ServerFormProvider methods={form.methods}>
      <form.fetcher.Form
        ref={form.formRef}
        method="post"
        onSubmit={form.methods.handleSubmit}
        noValidate
        className="flex flex-col gap-2 sm:flex-row sm:items-start"
      >
        <HoneypotInputs />
        <InputField
          name="code"
          label="Pass code"
          description="What the school hands out (driverush.ke/pass?code=…)."
          className="sm:w-72"
          disabled={form.busy}
          inputProps={{ autoCapitalize: "characters" }}
        />
        <Button
          type="submit"
          size="sm"
          variant="paper"
          className="sm:mt-6"
          isLoading={form.busy}
        >
          Save code
        </Button>
      </form.fetcher.Form>
    </ServerFormProvider>
  );
}

function DirectBank({
  schoolId,
  schoolName,
  code,
  banks,
  paymentsOn,
  live,
}: {
  schoolId: string;
  schoolName: string;
  code: string;
  banks: { name: string; code: string }[];
  paymentsOn: boolean;
  live: boolean;
}) {
  const form = useServerForm({
    schema: SetUpPaymentsSchema,
    key: `set-up-payments:${schoolId}`,
    resetOnSuccess: true,
    defaultValues: {
      intent: "set-up-payments" as const,
      schoolId,
      code,
      bankCode: "",
      accountNumber: "",
      accountName: schoolName,
    },
  });
  if (!paymentsOn) return null;
  return (
    <Collapsible>
      <CollapsibleTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="self-start">
          {live ? "Change the bank yourself" : "Set the bank yourself"}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-2">
        {banks.length === 0 ? (
          <Alert>
            <AlertBody>
              <AlertTitle>Paystack's bank list did not load</AlertTitle>
              <AlertDescription>Reload to try again.</AlertDescription>
            </AlertBody>
          </Alert>
        ) : (
          <ServerFormProvider methods={form.methods}>
            <form.fetcher.Form
              ref={form.formRef}
              method="post"
              onSubmit={form.methods.handleSubmit}
              noValidate
              className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4"
            >
              <HoneypotInputs />
              <p className="m-0 text-[13px] text-ink-2">
                Only for a bank you have already checked with the school. It
                goes live at once, with no review.
              </p>
              <InputField
                name="code"
                label="Pass code"
                className="sm:w-72"
                disabled={form.busy}
                inputProps={{ autoCapitalize: "characters" }}
              />
              <BankFields banks={banks} disabled={form.busy} />
              <Button
                type="submit"
                size="sm"
                variant="paper"
                className="self-start"
                isLoading={form.busy}
              >
                {live ? "Change bank" : "Turn on payments"}
              </Button>
            </form.fetcher.Form>
          </ServerFormProvider>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
