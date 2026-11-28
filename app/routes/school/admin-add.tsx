/**
 * `/school/:schoolId/team/add`: "Add admin", a modal over the team list
 * (owner). An email and the branches they work in; they are emailed a link.
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
  CheckboxGroupField,
  InputField,
  ServerFormProvider,
} from "~/components/ui/forms/server";
import { requireUser } from "~/lib/auth/require.server";
import { useServerForm } from "~/lib/forms/use-server-form";
import { schoolAction } from "~/lib/school/action.server";
import { useSchool, useSchoolPath } from "~/lib/school/use-school";
import { AddAdminSchema } from "~/schemas/school";

import type { Route } from "./+types/admin-add";

export async function action({ request, params }: Route.ActionArgs) {
  const context = await requireUser(request);
  return schoolAction(context, params.schoolId, request);
}

export default function AdminAdd() {
  const path = useSchoolPath();
  const d = useSchool();
  const here = path("team/add");
  const closeTo = useCloseTo(path("team"));
  const onlyBranch = d.branches.length === 1 ? d.branches[0]?.id : undefined;
  const { methods, fetcher, formRef, busy } = useServerForm({
    schema: AddAdminSchema,
    key: "add-admin",
    action: here,
    defaultValues: {
      intent: "add-admin",
      email: "",
      branchIds: onlyBranch ? [onlyBranch] : [],
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
    <RouteModal closeTo={closeTo} label="Team">
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
            title="Add admin"
            description="An admin adds students to their branches and follows their progress. They are emailed a link."
          />
          <RouteModalBody className="flex flex-col gap-3 pt-4">
            <HoneypotInputs />
            <InputField
              name="email"
              label="Admin's email"
              disabled={busy}
              inputProps={{
                type: "email",
                inputMode: "email",
                placeholder: "name@school.co.ke",
                autoFocus: true,
              }}
            />
            <CheckboxGroupField
              name="branchIds"
              label="Branches"
              options={d.branches.map((b) => ({ label: b.name, value: b.id }))}
              disabled={busy}
            />
          </RouteModalBody>
          <RouteModalFooter closeTo={closeTo} busy={busy}>
            <Button type="submit" variant="rush" isLoading={busy}>
              Add admin
            </Button>
          </RouteModalFooter>
        </fetcher.Form>
      </ServerFormProvider>
    </RouteModal>
  );
}
