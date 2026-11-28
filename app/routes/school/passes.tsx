/**
 * `/school/:schoolId/passes`: the code learners pay through and the link
 * to hand out; the owner sets the price and sends the bank (DriveRush checks
 * it). Then what the school earned (an admin sees their branches).
 */
import { Outlet } from "react-router";

import { PageHeader } from "~/components/console/shell";
import { EarningsPanel, PassPanel } from "~/components/school/pass-panel";
import { requireUser } from "~/lib/auth/require.server";
import { schoolAction } from "~/lib/school/action.server";
import { useSchool } from "~/lib/school/use-school";

import type { Route } from "./+types/passes";

export async function action({ request, params }: Route.ActionArgs) {
  const context = await requireUser(request);
  return schoolAction(context, params.schoolId, request);
}

export default function SchoolPasses() {
  const d = useSchool();
  return (
    <>
      <PageHeader
        title="Passes"
        description="How your learners pay for the full course through you, and what you have earned."
      />
      <div className="flex flex-col gap-10">
        <PassPanel
          schoolId={d.school.id}
          schoolName={d.school.name}
          info={d.passInfo}
          canManage={d.canManage}
          paymentsOn={d.paymentsOn}
        />
        <EarningsPanel rows={d.earnings} ready={d.passInfo?.ready ?? false} />
      </div>
      <Outlet />
    </>
  );
}
