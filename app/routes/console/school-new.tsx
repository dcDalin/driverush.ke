/**
 * `/console/schools/new`: "New school", a modal over the school list. The
 * school's name, its short name and, if staff have it, the owner's email.
 * Without an email the school starts in set-up, hidden from everyone until
 * staff hand it over; with one it is live at once. Either way the console
 * opens the new school's page.
 */
import * as React from "react";
import { data } from "react-router";
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
import { getRequestClient, requireStaff } from "~/lib/auth/require.server";
import { consoleAction } from "~/lib/console/action.server";
import { consoleGate, GATED } from "~/lib/console/gate.server";
import { useServerForm } from "~/lib/forms/use-server-form";
import { CreateSchoolSchema } from "~/schemas/console";

import type { Route } from "./+types/school-new";

const HERE = "/console/schools/new";

export function meta() {
  return [
    { title: "New school | Console | DriveRush" },
    { name: "robots", content: "noindex" },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const context = await getRequestClient(request);
  const gate = await consoleGate(context);
  return data(gate.ok ? { gated: false as const } : GATED, {
    headers: context.headers,
  });
}

export async function action({ request }: Route.ActionArgs) {
  const staff = await requireStaff(request);
  return consoleAction(staff, await request.formData(), request);
}

/** "Top Gear Driving School" → "top-gear-driving-school". */
function slugOf(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export default function SchoolNew({ loaderData }: Route.ComponentProps) {
  const closeTo = useCloseTo("/console/schools");
  const { methods, fetcher, formRef, busy } = useServerForm({
    schema: CreateSchoolSchema,
    key: "create-school",
    action: HERE,
    defaultValues: {
      intent: "create-school",
      name: "",
      slug: "",
      ownerEmail: "",
    },
  });
  // The short name follows the name until staff type their own.
  const slugTouched = methods.formState.dirtyFields.slug;
  const name = methods.watch("name");
  React.useEffect(() => {
    if (!slugTouched) methods.setValue("slug", slugOf(name ?? ""));
  }, [name, slugTouched, methods]);

  if (loaderData.gated) return null;
  return (
    <RouteModal closeTo={closeTo} label="Schools">
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
            title="New school"
            description="With the owner's email, they get the school at once and fill in the rest. Leave it empty to upload the livery first: the school stays hidden until you hand it over."
          />
          <RouteModalBody className="flex flex-col gap-3 pt-4">
            <HoneypotInputs />
            <InputField
              name="name"
              label="School name"
              disabled={busy}
              inputProps={{
                placeholder: "Heltz Driving Academy",
                autoFocus: true,
              }}
            />
            <InputField
              name="slug"
              label="Short name (for links)"
              description="Lowercase, like heltz. It is the school's address on DriveRush."
              disabled={busy}
              inputProps={{ placeholder: "heltz" }}
            />
            <InputField
              name="ownerEmail"
              label="Owner's email (optional)"
              disabled={busy}
              inputProps={{
                type: "email",
                inputMode: "email",
                placeholder: "owner@school.co.ke",
              }}
            />
          </RouteModalBody>
          <RouteModalFooter closeTo={closeTo} busy={busy}>
            <Button type="submit" variant="rush" isLoading={busy}>
              Create school
            </Button>
          </RouteModalFooter>
        </fetcher.Form>
      </ServerFormProvider>
    </RouteModal>
  );
}
