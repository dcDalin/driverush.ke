/**
 * `/console/staff`: who holds a DriveRush staff role (su only). Revoke from
 * a row; "Add staff" is a modal route over the list (`staff/grant`).
 */
import { data, Link, Outlet } from "react-router";

import { Icon } from "~/components/brand/icon";
import { PlusIcon } from "~/components/brand/icons";
import { StaffList } from "~/components/console/console-panels";
import { PageHeader } from "~/components/console/shell";
import { NothingHere } from "~/components/school/signed-out";
import { Button } from "~/components/ui/button";
import { listStaff } from "~/database/console/queries";
import { getRequestClient, requireStaff } from "~/lib/auth/require.server";
import { consoleAction } from "~/lib/console/action.server";
import { consoleGate, GATED } from "~/lib/console/gate.server";

import type { Route } from "./+types/staff";

export function meta() {
  return [
    { title: "Staff | Console | DriveRush" },
    { name: "robots", content: "noindex" },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const context = await getRequestClient(request);
  const gate = await consoleGate(context);
  const { supabase, headers } = context;
  if (!gate.ok) return data(GATED, { headers });
  if (!gate.su) return data({ su: false as const }, { headers });
  return data(
    {
      su: true as const,
      me: gate.staff.caller.userId,
      staff: await listStaff(supabase),
    },
    { headers },
  );
}

export async function action({ request }: Route.ActionArgs) {
  const staff = await requireStaff(request);
  return consoleAction(staff, await request.formData(), request);
}

export default function ConsoleStaff({ loaderData }: Route.ComponentProps) {
  if ("gated" in loaderData) return null;
  if (!loaderData.su) {
    return (
      <NothingHere
        title="Su only"
        body="Only a DriveRush su can see and change who is staff."
      />
    );
  }
  return (
    <>
      <PageHeader
        title="Staff"
        description="People with a DriveRush role. An admin runs schools and payments; a su also decides who is staff."
        actions={
          <Button asChild variant="rush">
            <Link to="/console/staff/grant" preventScrollReset>
              <Icon icon={PlusIcon} size={18} />
              Add staff
            </Link>
          </Button>
        }
      />
      <StaffList staff={loaderData.staff} me={loaderData.me} />
      <Outlet />
    </>
  );
}
