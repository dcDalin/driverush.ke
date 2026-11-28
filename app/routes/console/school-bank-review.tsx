/**
 * `/console/schools/:schoolId/payments/review/:decision`: approve the bank
 * the owner sent, or turn it down with a reason they read, in a modal over
 * the payments page.
 */
import { Navigate, useParams } from "react-router";

import { ModalForm } from "~/components/console/route-modal";
import { TextareaField } from "~/components/ui/forms/server";
import { requireStaff } from "~/lib/auth/require.server";
import { consoleAction } from "~/lib/console/action.server";
import {
  useConsoleSchool,
  useConsoleSchoolPath,
} from "~/lib/console/use-console-school";
import { useServerForm } from "~/lib/forms/use-server-form";
import { ReviewBankSchema } from "~/schemas/billing";

import type { Route } from "./+types/school-bank-review";

export async function action({ request }: Route.ActionArgs) {
  const staff = await requireStaff(request);
  return consoleAction(staff, await request.formData(), request);
}

export default function SchoolBankReview() {
  const consoleSchoolPath = useConsoleSchoolPath();
  const { school } = useConsoleSchool();
  const params = useParams();
  const id = school.school.id;
  const decision = params.decision === "decline" ? "decline" : "approve";
  const here = consoleSchoolPath(id, `payments/review/${decision}`);
  const closeTo = consoleSchoolPath(id, "payments");
  const pay = school.payments;
  const form = useServerForm({
    schema: ReviewBankSchema,
    key: `review-bank:${decision}:${id}`,
    action: here,
    defaultValues: {
      intent: "review-bank" as const,
      schoolId: id,
      decision,
      note: "",
    },
  });
  // Nothing is waiting (already answered, or a stale link): back to the page.
  if (!pay?.pending_bank_label && !form.busy) {
    return <Navigate to={closeTo} replace />;
  }
  const bank = pay?.pending_bank_label ?? "this bank";
  return decision === "approve" ? (
    <ModalForm
      form={form}
      here={here}
      closeTo={closeTo}
      label={school.school.name}
      title="Approve this bank?"
      description={`From now on, the school's share of every pass bought through it goes to ${bank}${pay?.bank_label ? `, not ${pay.bank_label}` : ""}.`}
      submit="Approve"
    >
      <p className="m-0 text-[14px] text-ink-2">
        Only after you have called the school and checked it against their bank
        letter.
      </p>
    </ModalForm>
  ) : (
    <ModalForm
      form={form}
      here={here}
      closeTo={closeTo}
      label={school.school.name}
      title="Turn this bank down"
      description={`${bank} is not used, and the owner can send another.`}
      submit="Turn it down"
    >
      <TextareaField
        name="note"
        label="Why?"
        description="The owner reads this on their dashboard and by email."
        disabled={form.busy}
      />
    </ModalForm>
  );
}
