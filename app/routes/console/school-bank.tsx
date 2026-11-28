/**
 * `/console/schools/:schoolId/payments/bank`: staff set the school's bank
 * themselves, in a modal over the payments page. Only for a bank already
 * checked with the school: it goes live at once, with no review.
 */
import { ModalForm } from "~/components/console/route-modal";
import { BankFields } from "~/components/school/bank-fields";
import {
  Alert,
  AlertBody,
  AlertDescription,
  AlertTitle,
} from "~/components/ui/alert";
import { InputField } from "~/components/ui/forms/server";
import { requireStaff } from "~/lib/auth/require.server";
import { consoleAction } from "~/lib/console/action.server";
import {
  useConsoleSchool,
  useConsoleSchoolPath,
} from "~/lib/console/use-console-school";
import { useServerForm } from "~/lib/forms/use-server-form";
import { SetUpPaymentsSchema } from "~/schemas/billing";

import type { Route } from "./+types/school-bank";

export async function action({ request }: Route.ActionArgs) {
  const staff = await requireStaff(request);
  return consoleAction(staff, await request.formData(), request);
}

export default function SchoolBank() {
  const consoleSchoolPath = useConsoleSchoolPath();
  const { school, banks } = useConsoleSchool();
  const { id, name, slug } = school.school;
  const here = consoleSchoolPath(id, "payments/bank");
  const live = Boolean(school.payments?.ready);
  const form = useServerForm({
    schema: SetUpPaymentsSchema,
    key: `set-up-payments:${id}`,
    action: here,
    defaultValues: {
      intent: "set-up-payments" as const,
      schoolId: id,
      code:
        school.payments?.code ??
        slug
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, "")
          .slice(0, 12),
      bankCode: "",
      accountNumber: "",
      accountName: name,
    },
  });
  return (
    <ModalForm
      form={form}
      here={here}
      closeTo={consoleSchoolPath(id, "payments")}
      label={name}
      size="md"
      title={live ? "Change the bank yourself" : "Set the bank yourself"}
      description="Only for a bank you have already checked with the school. It goes live at once, with no review."
      submit={live ? "Change bank" : "Turn on payments"}
    >
      {banks.length === 0 ? (
        <Alert>
          <AlertBody>
            <AlertTitle>Paystack's bank list did not load</AlertTitle>
            <AlertDescription>Reload to try again.</AlertDescription>
          </AlertBody>
        </Alert>
      ) : (
        <>
          <InputField
            name="code"
            label="Pass code"
            disabled={form.busy}
            inputProps={{ autoCapitalize: "characters" }}
          />
          <BankFields banks={banks} disabled={form.busy} />
        </>
      )}
    </ModalForm>
  );
}
