/**
 * `/school/:schoolId/students/add`: "Add student", a modal over the
 * students list. An email and one of the person's open branches; the
 * student is emailed a link.
 */
import * as React from "react";
import { useNavigate } from "react-router";
import { HoneypotInputs } from "remix-utils/honeypot/react";

import {
  RouteModal,
  RouteModalBody,
  RouteModalFooter,
  RouteModalHeader,
  useCloseTo,
} from "~/components/console/route-modal";
import { Button } from "~/components/ui/button";
import {
  InputField,
  SelectField,
  ServerFormProvider,
} from "~/components/ui/forms/server";
import { requireUser } from "~/lib/auth/require.server";
import { useServerForm } from "~/lib/forms/use-server-form";
import { schoolAction } from "~/lib/school/action.server";
import { schoolPath } from "~/lib/school/nav";
import { useSchool } from "~/lib/school/use-school";
import { AddStudentSchema } from "~/schemas/school";

import type { Route } from "./+types/student-add";

export async function action({ request, params }: Route.ActionArgs) {
  const context = await requireUser(request);
  return schoolAction(context, params.schoolId, request);
}

export default function StudentAdd() {
  const d = useSchool();
  const here = schoolPath(d.school.id, "students/add");
  const closeTo = useCloseTo(schoolPath(d.school.id, "students"));
  const branches = d.branches.filter(
    (b) => b.is_active && d.myBranchIds.includes(b.id),
  );
  const { methods, fetcher, formRef, busy } = useServerForm({
    schema: AddStudentSchema,
    key: "add-student",
    action: here,
    defaultValues: {
      intent: "add-student",
      email: "",
      branchId: branches[0]?.id ?? "",
    },
  });
  // Done: back to the list, which now shows it.
  const navigate = useNavigate();
  const done =
    fetcher.state === "idle" &&
    (fetcher.data as { ok?: boolean } | undefined)?.ok === true;
  React.useEffect(() => {
    if (done)
      void navigate(closeTo, { replace: true, preventScrollReset: true });
  }, [done, navigate, closeTo]);

  return (
    <RouteModal closeTo={closeTo} label="Students">
      <ServerFormProvider methods={methods}>
        <fetcher.Form
          ref={formRef}
          method="post"
          action={here}
          onSubmit={methods.handleSubmit}
          noValidate
          className="contents"
        >
          <RouteModalHeader
            title="Add student"
            description="They are emailed a link. They are with you for a month from the day they sign in with this email."
          />
          <RouteModalBody className="flex flex-col gap-3 pt-4">
            <HoneypotInputs />
            <InputField
              name="email"
              label="Student's email"
              disabled={busy}
              inputProps={{
                type: "email",
                inputMode: "email",
                placeholder: "name@gmail.com",
                autoFocus: true,
              }}
            />
            <SelectField
              name="branchId"
              label="Branch"
              disabled={busy}
              options={branches.map((b) => ({ label: b.name, value: b.id }))}
            />
          </RouteModalBody>
          <RouteModalFooter closeTo={closeTo} busy={busy}>
            <Button
              type="submit"
              variant="rush"
              isLoading={busy}
              disabled={branches.length === 0}
            >
              Add student
            </Button>
          </RouteModalFooter>
        </fetcher.Form>
      </ServerFormProvider>
    </RouteModal>
  );
}
