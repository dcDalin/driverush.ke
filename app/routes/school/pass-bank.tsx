/**
 * `/school/:schoolId/passes/bank`: the owner sends the school's bank, in a
 * modal over the passes page. DriveRush checks it before it goes live; a
 * bank already being paid keeps being paid until then.
 */
import { Navigate } from "react-router";

import { ModalForm } from "~/components/console/route-modal";
import { BankFields } from "~/components/school/bank-fields";
import {
  Alert,
  AlertBody,
  AlertDescription,
  AlertTitle,
} from "~/components/ui/alert";
import { requireUser } from "~/lib/auth/require.server";
import { useServerForm } from "~/lib/forms/use-server-form";
import { schoolAction } from "~/lib/school/action.server";
import { schoolPath } from "~/lib/school/nav";
import { useSchool } from "~/lib/school/use-school";
import { RequestBankSchema } from "~/schemas/billing";

import type { Route } from "./+types/pass-bank";

export async function action({ request, params }: Route.ActionArgs) {
  const context = await requireUser(request);
  return schoolAction(context, params.schoolId, request);
}

export default function PassBank() {
  const d = useSchool();
  const closeTo = schoolPath(d.school.id, "passes");
  const here = schoolPath(d.school.id, "passes/bank");
  const form = useServerForm({
    schema: RequestBankSchema,
    key: "request-bank",
    action: here,
    defaultValues: {
      intent: "request-bank" as const,
      bankCode: "",
      accountNumber: "",
      accountName: "",
    },
  });
  // Owner only, with payments on, and not while one is being checked.
  const waiting = Boolean(d.passInfo?.pending_bank_label);
  if (!d.canManage || !d.paymentsOn || (waiting && !form.busy)) {
    return <Navigate to={closeTo} replace />;
  }
  const replacing = Boolean(d.passInfo?.ready);
  return (
    <ModalForm
      form={form}
      here={here}
      closeTo={closeTo}
      label="Passes"
      size="md"
      title={replacing ? "Change your bank" : "Add your bank"}
      description="Paystack pays your share of every pass here. DriveRush calls you to check it against your bank letter before it goes live. We keep only the bank and the last four digits."
      submit={replacing ? "Send the new bank" : "Send to DriveRush"}
    >
      {d.banks.length === 0 ? (
        <Alert>
          <AlertBody>
            <AlertTitle>The bank list did not load</AlertTitle>
            <AlertDescription>Reload to try again.</AlertDescription>
          </AlertBody>
        </Alert>
      ) : (
        <BankFields banks={d.banks} disabled={form.busy} />
      )}
    </ModalForm>
  );
}
