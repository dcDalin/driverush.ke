/**
 * `/console/schools/:schoolId`: one school for DriveRush staff.
 *
 *   Set-up     what is done (profile and logo, branches, livery, owner),
 *              with a link to the school's dashboard for its profile and
 *              branches; its status.
 *   Hand over  the owner's email becomes its owner (added, or invited until
 *              they sign up); a school in set-up goes live.
 *   Livery     upload the school's livery folder as a draft, preview it on
 *              the board, publish, retire or delete.
 *   Payments   its code, the bank its owner sent (approve or turn down),
 *              a checked bank set by staff, its earnings.
 *   Sponsorship when its cars take turns.
 *   The tab is kept in the address (`?tab=payments`).
 *
 * Drawn inside the console's frame (`layouts/console-layout.tsx`). Changes go through
 * `consoleAction`, as on every console page.
 */
import { data, Link } from "react-router";

import { Icon } from "~/components/brand/icon";
import { ArrowLeftIcon } from "~/components/brand/icons";
import { Sponsorships } from "~/components/console/console-panels";
import {
  LiveryList,
  LiveryUploader,
} from "~/components/console/school-liveries";
import { SchoolPaymentsBlock } from "~/components/console/school-payments";
import {
  HandOver,
  SchoolStatusControl,
  SetupChecklist,
} from "~/components/console/school-setup";
import { STATUS_BADGE, STATUS_LABEL } from "~/components/console/school-status";
import { PageHeader } from "~/components/console/shell";
import { NothingHere } from "~/components/school/signed-out";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { listSchoolEarnings } from "~/database/billing/school";
import { getConsoleSchool } from "~/database/console/queries";
import { getRequestClient, requireStaff } from "~/lib/auth/require.server";
import { consoleAction } from "~/lib/console/action.server";
import { consoleGate, GATED } from "~/lib/console/gate.server";
import { kenyanBanks } from "~/lib/payments/banks.server";
import { paymentsEnabled } from "~/lib/payments/env.server";
import { useLiveRevalidate } from "~/lib/realtime/use-live-revalidate";
import { useTabParam } from "~/lib/ui/use-tab-param";

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

const SCHOOL_TABS = ["livery", "payments", "sponsorship"] as const;

function SchoolPage({
  school,
  earnings,
  banks,
  paymentsOn,
}: Extract<Route.ComponentProps["loaderData"], { state: "ok" }>) {
  const { id, name, slug, status } = school.school;
  const [tab, setTab] = useTabParam(SCHOOL_TABS);
  useLiveRevalidate([`school:${id}`]);
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
      >
        <SchoolStatusControl schoolId={id} status={status} />
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-2">
        <SetupChecklist school={school} />
        <HandOver school={school} />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="livery">Livery</TabsTrigger>
          <TabsTrigger value="payments">
            Payments
            {school.payments?.pending_bank_label ? (
              <Badge variant="amber" className="ml-1">
                1
              </Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="sponsorship">Sponsorship</TabsTrigger>
        </TabsList>
        <TabsContent value="livery" className="flex flex-col gap-4 pt-4">
          <LiveryUploader schoolId={id} />
          <LiveryList liveries={school.liveries} />
        </TabsContent>
        <TabsContent value="sponsorship" className="pt-4">
          <Sponsorships schoolId={id} sponsorships={school.sponsorships} />
        </TabsContent>
        <TabsContent value="payments" className="pt-4">
          <SchoolPaymentsBlock
            schoolId={id}
            schoolName={name}
            suggestedCode={slug
              .toUpperCase()
              .replace(/[^A-Z0-9]/g, "")
              .slice(0, 12)}
            payments={school.payments}
            earnings={earnings}
            banks={banks}
            paymentsOn={paymentsOn}
          />
        </TabsContent>
      </Tabs>
    </>
  );
}
