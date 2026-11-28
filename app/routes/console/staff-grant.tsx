/**
 * `/console/staff/grant`: "Add staff", a modal over the staff list (su
 * only; the database checks again). The person must already have a DriveRush
 * account with that email.
 */
import * as React from "react";
import { useNavigate } from "react-router";
import { HoneypotInputs } from "remix-utils/honeypot/react";

import {
  RouteModal,
  RouteModalBody,
  RouteModalFooter,
  RouteModalHeader,
} from "~/components/console/route-modal";
import { Button } from "~/components/ui/button";
import {
  InputField,
  SelectField,
  ServerFormProvider,
} from "~/components/ui/forms/server";
import { requireStaff } from "~/lib/auth/require.server";
import { consoleAction } from "~/lib/console/action.server";
import { useServerForm } from "~/lib/forms/use-server-form";
import { GrantRoleSchema } from "~/schemas/console";

import type { Route } from "./+types/staff-grant";

const HERE = "/console/staff/grant";
const CLOSE_TO = "/console/staff";

export function meta() {
  return [
    { title: "Add staff | Console | DriveRush" },
    { name: "robots", content: "noindex" },
  ];
}

/*
 * No loader: the page under this modal (the schools list, the staff list)
 * only draws it for staff (a su for staff), so opening it costs no server
 * trip. The action checks again.
 */

export async function action({ request }: Route.ActionArgs) {
  const staff = await requireStaff(request);
  return consoleAction(staff, await request.formData(), request);
}

export default function StaffGrant() {
  const navigate = useNavigate();
  const { methods, fetcher, formRef, busy } = useServerForm({
    schema: GrantRoleSchema,
    key: "grant-role",
    action: HERE,
    defaultValues: { intent: "grant-role", email: "", role: "driverush_admin" },
  });
  // Granted: back to the list, which now shows them.
  const granted =
    fetcher.state === "idle" &&
    (fetcher.data as { ok?: boolean } | undefined)?.ok === true;
  React.useEffect(() => {
    if (granted)
      void navigate(CLOSE_TO, { replace: true, preventScrollReset: true });
  }, [granted, navigate]);

  return (
    <RouteModal closeTo={CLOSE_TO} label="Staff">
      <ServerFormProvider methods={methods}>
        <fetcher.Form
          ref={formRef}
          method="post"
          action={HERE}
          onSubmit={methods.handleSubmit}
          noValidate
          className="contents"
        >
          <RouteModalHeader
            title="Add staff"
            description="They need a DriveRush account with this email first. The role works the next time they sign in."
          />
          <RouteModalBody className="flex flex-col gap-3 pt-4">
            <HoneypotInputs />
            <InputField
              name="email"
              label="Email"
              disabled={busy}
              inputProps={{
                type: "email",
                inputMode: "email",
                autoFocus: true,
              }}
            />
            <SelectField
              name="role"
              label="Role"
              disabled={busy}
              options={[
                { label: "Admin", value: "driverush_admin" },
                { label: "Su", value: "driverush_su" },
              ]}
            />
          </RouteModalBody>
          <RouteModalFooter closeTo={CLOSE_TO} busy={busy}>
            <Button type="submit" variant="rush" isLoading={busy}>
              Grant role
            </Button>
          </RouteModalFooter>
        </fetcher.Form>
      </ServerFormProvider>
    </RouteModal>
  );
}
