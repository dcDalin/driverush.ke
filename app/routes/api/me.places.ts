/**
 * `/api/me/places`: where the signed-in person can go besides the course,
 * for the account menu: the DriveRush console (staff) and the schools they
 * own or help run. A resource route: no page of its own.
 */
import { data } from "react-router";

import { isStaffRole } from "~/database/auth/roles";
import { listMySchools } from "~/database/schools/queries";
import { requireUser } from "~/lib/auth/require.server";

import type { Route } from "./+types/me.places";

export async function loader({ request }: Route.LoaderArgs) {
  const { supabase, headers, caller } = await requireUser(request);
  const schools = await listMySchools(supabase, caller.userId);
  return data(
    {
      staff: isStaffRole(caller.role),
      schools: schools
        .filter((s) => s.status !== "archived")
        .map((s) => ({ id: s.id, name: s.name, role: s.role })),
    },
    { headers },
  );
}
