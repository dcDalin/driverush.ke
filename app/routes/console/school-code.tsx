/**
 * `/console/schools/:schoolId/payments/code`: the code the school hands
 * out, in a modal over the payments page.
 */
import { ModalForm } from "~/components/console/route-modal";
import { InputField } from "~/components/ui/forms/server";
import { requireStaff } from "~/lib/auth/require.server";
import { consoleAction } from "~/lib/console/action.server";
import {
  consoleSchoolPath,
  useConsoleSchool,
} from "~/lib/console/use-console-school";
import { useServerForm } from "~/lib/forms/use-server-form";
import { SetPassCodeSchema } from "~/schemas/billing";

import type { Route } from "./+types/school-code";

export async function action({ request }: Route.ActionArgs) {
  const staff = await requireStaff(request);
  return consoleAction(staff, await request.formData(), request);
}

export default function SchoolCode() {
  const { school } = useConsoleSchool();
  const id = school.school.id;
  const here = consoleSchoolPath(id, "payments/code");
  const form = useServerForm({
    schema: SetPassCodeSchema,
    key: `set-pass-code:${id}`,
    action: here,
    defaultValues: {
      intent: "set-pass-code" as const,
      schoolId: id,
      code: school.payments?.code ?? "",
    },
  });
  return (
    <ModalForm
      form={form}
      here={here}
      closeTo={consoleSchoolPath(id, "payments")}
      label={school.school.name}
      title="Change the pass code"
      description="Links and posters with the old code stop working, so tell the school first."
      submit="Save code"
    >
      <InputField
        name="code"
        label="Pass code"
        description="What the school hands out (driverush.ke/pass?code=…)."
        disabled={form.busy}
        inputProps={{ autoCapitalize: "characters", autoFocus: true }}
      />
    </ModalForm>
  );
}
