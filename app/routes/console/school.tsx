/**
 * `/console/schools/:schoolId`: one school for DriveRush staff, as a frame
 * around its own pages. The header says which school, its status and owner,
 * and holds the two changes that are about the school itself; the tabs are
 * pages, and every change opens as a modal route over the page it belongs to:
 *
 *   (index)       Set-up: what is done and what is left, each step linking
 *                 to where it is done
 *     hand-over   give it to its owner (a school in set-up goes live)
 *     status      active, suspended or archived
 *   livery        the school's liveries
 *     upload      upload a livery folder as a draft
 *     :id/:verb   publish, retire or delete one
 *   payments      its code, price and bank; what it earned
 *     review/:d   approve or turn down a bank its owner sent
 *     code, bank  change the code; set a checked bank yourself
 *   sponsorship   when its cars take turns
 *     new         a new sponsorship period
 *
 * This loader reads the school once; the pages under it have none and read
 * it through `useConsoleSchool()`. Changes go through `consoleAction`.
 */
import { data, Link, Outlet } from "react-router";

import { Icon } from "~/components/brand/icon";
import { ArrowLeftIcon, ArrowOutIcon } from "~/components/brand/icons";
import { STATUS_BADGE, STATUS_LABEL } from "~/components/console/school-status";
import { PageHeader, RouteTabs } from "~/components/console/shell";
import { NothingHere } from "~/components/school/signed-out";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { listSchoolEarnings } from "~/database/billing/school";
import { getConsoleSchool } from "~/database/console/queries";
import { getRequestClient, requireStaff } from "~/lib/auth/require.server";
import { consoleAction } from "~/lib/console/action.server";
import { consoleGate, GATED } from "~/lib/console/gate.server";
import { consoleSchoolPath } from "~/lib/console/use-console-school";
import { kenyanBanks } from "~/lib/payments/banks.server";
import { paymentsEnabled } from "~/lib/payments/env.server";
import { useLiveRevalidate } from "~/lib/realtime/use-live-revalidate";

import type { Route } from "./+types/school";

export function meta({ data: loaded }: Route.MetaArgs) {
  const name =
    loaded && "school" in loaded && loaded.school
      ? loaded.school.school.name
      : "School";
  return [
    { title: `${name} | Console | DriveRush` },
    { name: "robots", content: "noindex" },
  ];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const context = await getRequestClient(request);
  const gate = await consoleGate(context);
  const { supabase, headers } = context;
  if (!gate.ok) return data(GATED, { headers });
  const [school, earnings, banks] = await Promise.all([
    getConsoleSchool(supabase, params.schoolId),
    listSchoolEarnings(supabase, params.schoolId).catch(() => []),
    kenyanBanks(),
  ]);
  if (!school)
    return data({ state: "missing" as const }, { headers, status: 404 });
  return data(
    {
      state: "ok" as const,
      school,
      earnings,
      banks,
      paymentsOn: paymentsEnabled(),
    },
    { headers },
  );
}

export async function action({ request }: Route.ActionArgs) {
  const staff = await requireStaff(request);
  return consoleAction(staff, await request.formData(), request);
}

export default function ConsoleSchool({ loaderData }: Route.ComponentProps) {
  if ("gated" in loaderData) return null;
  if (loaderData.state === "missing") {
    return (
      <NothingHere
        title="No such school"
        body="It may have been removed. Go back to the console's list."
      />
    );
  }
  return <SchoolPage {...loaderData} />;
}

function SchoolPage({
  school,
}: Extract<Route.ComponentProps["loaderData"], { state: "ok" }>) {
  const { id, name, slug, status } = school.school;
  useLiveRevalidate([`school:${id}`]);
  const to = (page = "") => consoleSchoolPath(id, page);
  const inSetup = status === "setup";
  const dot = (
    <Badge variant="amber" className="px-1.5">
      1
    </Badge>
  );
  return (
    <>
      <Button variant="ghost" size="sm" asChild className="-mb-3 self-start">
        <Link to="/console/schools">
          <Icon icon={ArrowLeftIcon} size={16} />
          All schools
        </Link>
      </Button>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            {name}
            <Badge variant={STATUS_BADGE[status]}>{STATUS_LABEL[status]}</Badge>
          </span>
        }
        description={
          <>
            /{slug} ·{" "}
            {school.ownerEmail
              ? `Owner ${school.ownerEmail}`
              : school.invitedOwnerEmail
                ? `Invited ${school.invitedOwnerEmail}`
                : "No owner yet"}
          </>
        }
        actions={
          <>
            <Button asChild variant="ghost">
              <Link to={`/school/${id}`}>
                Its dashboard
                <Icon icon={ArrowOutIcon} size={16} />
              </Link>
            </Button>
            <Button asChild variant="paper">
              <Link to={to("status")} preventScrollReset>
                Change status
              </Link>
            </Button>
            <Button asChild variant={inSetup ? "rush" : "paper"}>
              <Link to={to("hand-over")} preventScrollReset>
                {inSetup ? "Hand over" : "Change owner"}
              </Link>
            </Button>
          </>
        }
      />
      <RouteTabs
        label="This school"
        tabs={[
          { label: "Set-up", to: to(), end: true },
          {
            label: "Livery",
            to: to("livery"),
            badge: school.setup.livery === "draft" ? dot : null,
          },
          {
            label: "Payments",
            to: to("payments"),
            badge: school.payments?.pending_bank_label ? dot : null,
          },
          { label: "Sponsorship", to: to("sponsorship") },
        ]}
      />
      <Outlet />
    </>
  );
}
