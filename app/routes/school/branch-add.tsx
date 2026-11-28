/**
 * `/school/:schoolId/branches/add`: "Add branch", a modal over the
 * branches list (owner). A name and a town.
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
import { InputField, ServerFormProvider } from "~/components/ui/forms/server";
import { requireUser } from "~/lib/auth/require.server";
import { useServerForm } from "~/lib/forms/use-server-form";
import { schoolAction } from "~/lib/school/action.server";
import { schoolPath } from "~/lib/school/nav";
import { useSchool } from "~/lib/school/use-school";
import { AddBranchSchema } from "~/schemas/school";

import type { Route } from "./+types/branch-add";

export async function action({ request, params }: Route.ActionArgs) {
  const context = await requireUser(request);
  return schoolAction(context, params.schoolId, request);
}

export default function BranchAdd() {
  const d = useSchool();
  const here = schoolPath(d.school.id, "branches/add");
  const closeTo = useCloseTo(schoolPath(d.school.id, "branches"));
  const { methods, fetcher, formRef, busy } = useServerForm({
    schema: AddBranchSchema,
    key: "add-branch",
    action: here,
    defaultValues: { intent: "add-branch", name: "", town: "" },
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
    <RouteModal closeTo={closeTo} label="Branches">
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
            title="Add branch"
            description="Students and admins are added to a branch."
          />
          <RouteModalBody className="flex flex-col gap-3 pt-4">
            <HoneypotInputs />
            <InputField
              name="name"
              label="Branch name"
              disabled={busy}
              inputProps={{ placeholder: "Nairobi CBD", autoFocus: true }}
            />
            <InputField
              name="town"
              label="Town"
              disabled={busy}
              inputProps={{ placeholder: "Nairobi" }}
            />
          </RouteModalBody>
          <RouteModalFooter closeTo={closeTo} busy={busy}>
            <Button type="submit" variant="rush" isLoading={busy}>
              Add branch
            </Button>
          </RouteModalFooter>
        </fetcher.Form>
      </ServerFormProvider>
    </RouteModal>
  );
}
