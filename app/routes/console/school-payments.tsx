/**
 * `/console/schools/:schoolId/payments`: whether the school takes
 * payments, its code, price and bank, a bank its owner sent, and what it
 * earned. Each change is a modal route over this page.
 */
import { Outlet } from "react-router";

import { SchoolPaymentsBlock } from "~/components/console/school-payments";
import { requireStaff } from "~/lib/auth/require.server";
import { consoleAction } from "~/lib/console/action.server";
import { useConsoleSchool } from "~/lib/console/use-console-school";

import type { Route } from "./+types/school-payments";

export async function action({ request }: Route.ActionArgs) {
  const staff = await requireStaff(request);
  return consoleAction(staff, await request.formData(), request);
}

export default function SchoolPayments() {
  const { school, earnings, paymentsOn } = useConsoleSchool();
  return (
    <>
      <SchoolPaymentsBlock
        schoolId={school.school.id}
        payments={school.payments}
        earnings={earnings}
        paymentsOn={paymentsOn}
      />
      <Outlet />
    </>
  );
}
