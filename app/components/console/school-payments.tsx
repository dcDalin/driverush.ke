/**
 * Staff turn on a school's passes: its code and the bank its share settles to.
 * Saving makes a Paystack subaccount with the bank details (they stay in
 * Paystack; we keep a label). Paystack cannot check a Kenyan account number,
 * so confirm it with the school on the phone first, from its bank letter.
 */
import { HoneypotInputs } from "remix-utils/honeypot/react";

import { kes } from "~/components/account/pass-offers";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  InputField,
  SelectField,
  ServerFormProvider,
} from "~/components/ui/forms/server";
import { useServerForm } from "~/lib/forms/use-server-form";
import { SetUpPaymentsSchema } from "~/schemas/billing";

export type SchoolPayments = {
  code: string;
  price_kes: number;
  bank_label: string | null;
  ready: boolean;
} | null;

export function SchoolPaymentsBlock({
  schoolId,
  schoolName,
  suggestedCode,
  payments,
  banks,
  paymentsOn,
}: {
  schoolId: string;
  schoolName: string;
  suggestedCode: string;
  payments: SchoolPayments;
  banks: { name: string; code: string }[];
  paymentsOn: boolean;
}) {
  const form = useServerForm({
    schema: SetUpPaymentsSchema,
    key: `set-up-payments:${schoolId}`,
    resetOnSuccess: true,
    defaultValues: {
      intent: "set-up-payments" as const,
      schoolId,
      code: payments?.code ?? suggestedCode,
      bankCode: "",
      accountNumber: "",
      businessName: schoolName,
    },
  });
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-[13px] font-semibold text-ink-2">Passes</h3>
      {payments?.ready ? (
        <p className="m-0 flex flex-wrap items-center gap-2 text-[13px]">
          <Badge variant="green">taking payments</Badge>
          Code <span className="font-mono">{payments.code}</span>,{" "}
          {kes(payments.price_kes)}
          {payments.bank_label ? `, paid to ${payments.bank_label}` : ""}
        </p>
      ) : (
        <p className="m-0 text-[13px] text-ink-3">
          Not taking payments: its learners can only buy their own pass.
        </p>
      )}
      {!paymentsOn ? (
        <p className="m-0 text-[13px] text-ink-3">
          Payments are off on this server (no PAYSTACK_SECRET_KEY).
        </p>
      ) : banks.length === 0 ? (
        <p className="m-0 text-[13px] text-ink-3">
          Paystack's bank list did not load. Reload to try again.
        </p>
      ) : (
        <ServerFormProvider methods={form.methods}>
          <form.fetcher.Form
            ref={form.formRef}
            method="post"
            onSubmit={form.methods.handleSubmit}
            noValidate
            className="flex flex-wrap items-start gap-2"
          >
            <HoneypotInputs />
            <InputField
              name="code"
              label="Code"
              className="w-32"
              disabled={form.busy}
              inputProps={{ autoCapitalize: "characters" }}
            />
            <SelectField
              name="bankCode"
              label="Bank"
              placeholder="Pick the bank"
              disabled={form.busy}
              triggerClassName="w-56"
              options={banks.map((b) => ({ label: b.name, value: b.code }))}
            />
            <InputField
              name="accountNumber"
              label="Account number"
              className="w-44"
              disabled={form.busy}
              inputProps={{ inputMode: "numeric", autoComplete: "off" }}
            />
            <InputField
              name="businessName"
              label="Account name"
              className="w-56"
              disabled={form.busy}
            />
            <Button
              type="submit"
              size="sm"
              variant="paper"
              className="mt-6"
              isLoading={form.busy}
            >
              {payments?.ready ? "Change bank" : "Turn on payments"}
            </Button>
          </form.fetcher.Form>
        </ServerFormProvider>
      )}
    </div>
  );
}
