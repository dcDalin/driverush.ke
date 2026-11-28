/**
 * A school's first tab, Set-up, and the frame for the two modals that are
 * about the school itself (`hand-over`, `status`): they open over it
 * through the `<Outlet />`.
 */
import { Outlet } from "react-router";

import { SetupChecklist } from "~/components/console/school-setup";
import { requireStaff } from "~/lib/auth/require.server";
import { consoleAction } from "~/lib/console/action.server";
import { useConsoleSchool } from "~/lib/console/use-console-school";

import type { Route } from "./+types/school-setup";

export async function action({ request }: Route.ActionArgs) {
  const staff = await requireStaff(request);
  return consoleAction(staff, await request.formData(), request);
}

export default function SchoolSetup() {
  const { school } = useConsoleSchool();
  return (
    <>
      <SetupChecklist school={school} />
      <Outlet />
    </>
  );
}
