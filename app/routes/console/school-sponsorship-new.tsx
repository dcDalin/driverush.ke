/**
 * `/console/schools/:schoolId/sponsorship/new`: a new sponsorship period,
 * in a modal over the sponsorship page.
 */
import { kenyaToday } from "~/components/console/console-panels";
import { ModalForm } from "~/components/console/route-modal";
import { InputField } from "~/components/ui/forms/server";
import { requireStaff } from "~/lib/auth/require.server";
import { consoleAction } from "~/lib/console/action.server";
import {
  useConsoleSchool,
  useConsoleSchoolPath,
} from "~/lib/console/use-console-school";
import { useServerForm } from "~/lib/forms/use-server-form";
import { SetSponsorshipSchema } from "~/schemas/console";

import type { Route } from "./+types/school-sponsorship-new";

export async function action({ request }: Route.ActionArgs) {
  const staff = await requireStaff(request);
  return consoleAction(staff, await request.formData(), request);
}

export default function SchoolSponsorshipNew() {
  const consoleSchoolPath = useConsoleSchoolPath();
  const { school } = useConsoleSchool();
  const id = school.school.id;
  const here = consoleSchoolPath(id, "sponsorship/new");
  const form = useServerForm({
    schema: SetSponsorshipSchema,
    key: `set-sponsorship:${id}`,
    action: here,
    defaultValues: {
      intent: "set-sponsorship",
      schoolId: id,
      startsOn: kenyaToday(),
      endsOn: "",
      note: "",
    },
  });
  return (
    <ModalForm
      form={form}
      here={here}
      closeTo={consoleSchoolPath(id, "sponsorship")}
      label={school.school.name}
      title="New sponsorship period"
      description="Its cars take turns on the board from the first day, while it has a live livery."
      submit="Add period"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <InputField
          name="startsOn"
          label="From"
          disabled={form.busy}
          inputProps={{ type: "date" }}
        />
        <InputField
          name="endsOn"
          label="Until (optional)"
          disabled={form.busy}
          inputProps={{ type: "date" }}
        />
      </div>
      <InputField
        name="note"
        label="Note (optional)"
        disabled={form.busy}
        inputProps={{ placeholder: "Paid for Q1" }}
      />
    </ModalForm>
  );
}
