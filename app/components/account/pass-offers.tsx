/**
 * The ways to pay on /pass, each one form posting to the page's action: a
 * learner's own pass, a pass through a school (theirs, or the one whose code
 * they typed), and 30 more days. Paying sends them to Paystack's page.
 */
import { HoneypotInputs } from "remix-utils/honeypot/react";

import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { SelectField, ServerFormProvider } from "~/components/ui/forms/server";
import { useServerForm } from "~/lib/forms/use-server-form";
import { BuyPassSchema } from "~/schemas/billing";

export const kes = (n: number) => `KES ${n.toLocaleString("en-KE")}`;

function PayForm({
  formKey,
  values,
  label,
  branches,
}: {
  formKey: string;
  values:
    | { plan: "learner_pass" | "learner_extension"; level?: string }
    | {
        plan: "school_pass";
        schoolCode: string;
        branchId: string;
        level?: string;
      };
  label: string;
  /** A school with more than one branch: the learner picks theirs. */
  branches?: { id: string; name: string }[];
}) {
  const { methods, fetcher, formRef, busy } = useServerForm({
    schema: BuyPassSchema,
    key: formKey,
    defaultValues: { intent: "buy" as const, level: "", ...values },
  });
  return (
    <ServerFormProvider methods={methods}>
      <fetcher.Form
        ref={formRef}
        method="post"
        onSubmit={methods.handleSubmit}
        noValidate
        className="flex flex-col gap-3 sm:flex-row sm:items-end"
      >
        <HoneypotInputs />
        {branches && branches.length > 1 && (
          <SelectField
            name="branchId"
            label="Your branch"
            placeholder="Pick your branch"
            disabled={busy}
            triggerClassName="w-full sm:w-56"
            options={branches.map((b) => ({ label: b.name, value: b.id }))}
          />
        )}
        <Button type="submit" variant="rush" isLoading={busy}>
          {label}
        </Button>
      </fetcher.Form>
    </ServerFormProvider>
  );
}

export function OwnPass({
  price,
  days,
  level,
}: {
  price: number;
  days: number;
  level?: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>On your own</CardTitle>
        <CardDescription>
          {kes(price)} once, for {days} days. No subscription.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <PayForm
          formKey="buy-own"
          label={`Pay ${kes(price)}`}
          values={{ plan: "learner_pass", level }}
        />
      </CardContent>
    </Card>
  );
}

export function SchoolPass({
  schoolName,
  code,
  price,
  days,
  branchId,
  branchName,
  branches,
  level,
  linked,
}: {
  schoolName: string;
  code: string;
  price: number;
  days: number;
  branchId?: string;
  branchName?: string;
  branches?: { id: string; name: string }[];
  level?: string;
  linked?: boolean;
}) {
  const only = branches?.length === 1 ? branches[0]?.id : undefined;
  return (
    <Card className="border-2 border-ink">
      <CardHeader>
        <CardTitle>Through {schoolName}</CardTitle>
        <CardDescription>
          {kes(price)} once, for {days} days
          {branchName ? `, at ${branchName}` : ""}.{" "}
          {linked
            ? "Your school sees your progress."
            : "Your school sees your progress once you pay."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <PayForm
          formKey={`buy-school:${code}:${branchId ?? ""}`}
          label={`Pay ${kes(price)}`}
          branches={branchId ? undefined : branches}
          values={{
            plan: "school_pass",
            schoolCode: code,
            branchId: branchId ?? only ?? "",
            level,
          }}
        />
      </CardContent>
    </Card>
  );
}

export function MoreDays({
  price,
  days,
  level,
}: {
  price: number;
  days: number;
  level?: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{days} more days</CardTitle>
        <CardDescription>
          {kes(price)}, added after your pass ends. For a test date that moved,
          or another try.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <PayForm
          formKey="buy-more"
          label={`Add ${days} days for ${kes(price)}`}
          values={{ plan: "learner_extension", level }}
        />
      </CardContent>
    </Card>
  );
}
