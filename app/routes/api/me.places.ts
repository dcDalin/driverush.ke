/**
 * `/api/me/places`: where the signed-in person can go besides the course,
 * for the account menu: the DriveRush console (staff) and the schools they
 * own or help run. Staff on an emailed-code session (a password reset) still get
 * the console's link (`staffSignInAgain`); the console then says why. A resource route: no page of its own.
 */
import { data } from "react-router";

import { holdsStaffRole } from "~/database/auth/held-role";
import { isStaffRole } from "~/database/auth/roles";
import { listMySchools } from "~/database/schools/queries";
import { requireUser } from "~/lib/auth/require.server";

import type { Route } from "./+types/me.places";

export async function loader({ request }: Route.LoaderArgs) {
  const { supabase, headers, caller } = await requireUser(request);
  const staff = isStaffRole(caller.role);
  const [schools, onFile] = await Promise.all([
    listMySchools(supabase, caller.userId),
    staff ? true : holdsStaffRole(supabase, caller.userId),
  ]);
  return data(
    {
      staff,
      staffSignInAgain: !staff && onFile,
      schools: schools
        .filter((s) => s.status !== "archived")
        .map((s) => ({ id: s.id, name: s.name, role: s.role })),
    },
    { headers },
  );
}
