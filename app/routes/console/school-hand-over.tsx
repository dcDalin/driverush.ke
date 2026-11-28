/**
 * `/console/schools/:schoolId/hand-over`: gives the school to its owner, a
 * modal over Set-up. A school in set-up goes live; a live one changes hands.
 */
import { ModalForm } from "~/components/console/route-modal";
import { CheckboxField, InputField } from "~/components/ui/forms/server";
import { requireStaff } from "~/lib/auth/require.server";
import { consoleAction } from "~/lib/console/action.server";
import {
  useConsoleSchool,
  useConsoleSchoolPath,
} from "~/lib/console/use-console-school";
import { useServerForm } from "~/lib/forms/use-server-form";
import { HandOverSchema } from "~/schemas/console";

import type { Route } from "./+types/school-hand-over";

export async function action({ request }: Route.ActionArgs) {
  const staff = await requireStaff(request);
  return consoleAction(staff, await request.formData(), request);
}

export default function SchoolHandOver() {
  const consoleSchoolPath = useConsoleSchoolPath();
  const { school } = useConsoleSchool();
  const id = school.school.id;
  const inSetup = school.school.status === "setup";
  const form = useServerForm({
    schema: HandOverSchema,
    key: `hand-over:${id}`,
    action: consoleSchoolPath(id, "hand-over"),
    defaultValues: {
      intent: "hand-over",
      schoolId: id,
      email: "",
      keepPrevious: false,
    },
  });
  return (
    <ModalForm
      form={form}
      here={consoleSchoolPath(id, "hand-over")}
      closeTo={consoleSchoolPath(id)}
      label={school.school.name}
      title={inSetup ? "Hand over" : "Change owner"}
      description={
        inSetup
          ? "The owner gets the school's dashboard and the school goes live. Without an account yet, they are invited and own it once they sign up with this email."
          : "The new email becomes the owner. The old owner leaves the school unless you keep them as an admin. Without an account yet, they are invited."
      }
      submit={inSetup ? "Hand over and go live" : "Change owner"}
    >
      <InputField
        name="email"
        label="Owner's email"
        disabled={form.busy}
        inputProps={{
          type: "email",
          inputMode: "email",
          placeholder: "owner@school.co.ke",
          autoFocus: true,
        }}
      />
      {school.ownerEmail ? (
        <CheckboxField
          name="keepPrevious"
          label={`Keep ${school.ownerEmail} on as an admin of every branch`}
          disabled={form.busy}
        />
      ) : null}
      <p className="m-0 text-[13px] text-ink-3">
        We email them a link to their school.
      </p>
    </ModalForm>
  );
}
