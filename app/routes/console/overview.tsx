/**
 * `/console`: the console's first page. In order: what is waiting for
 * someone (banks to check, schools still being set up), the numbers with a
 * link into the page that owns each, this month's money, and the newest
 * schools. It adds nothing of its own; every figure opens the page behind it.
 */
import { data, Link } from "react-router";

import { Icon } from "~/components/brand/icon";
import {
  ArrowRightIcon,
  PlusIcon,
  SchoolIcon,
  StarIcon,
  WalletIcon,
} from "~/components/brand/icons";
import {
  BankRequests,
  PaymentTotalsGrid,
} from "~/components/console/payments-panel";
import { SchoolList } from "~/components/console/school-list";
import { PageHeader, Section, StatTile } from "~/components/console/shell";
import {
  Alert,
  AlertBody,
  AlertDescription,
  AlertTitle,
} from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { getPaymentTotals, listBankRequests } from "~/database/billing/school";
import {
  countConsoleSchools,
  listConsoleSchools,
  type SchoolFilters,
} from "~/database/console/queries";
import { getRequestClient, requireStaff } from "~/lib/auth/require.server";
import { consoleAction } from "~/lib/console/action.server";
import { consoleGate, GATED } from "~/lib/console/gate.server";
import { oncePerRequest } from "~/lib/server/once-per-request";

import type { Route } from "./+types/overview";

const ANY: SchoolFilters = {
  search: "",
  status: "any",
  livery: "any",
  sponsoring: "any",
  page: 1,
};
const LATEST = 5;

export async function loader({ request }: Route.LoaderArgs) {
  const context = await getRequestClient(request);
  const gate = await consoleGate(context);
  const { supabase, headers } = context;
  if (!gate.ok) return data(GATED, { headers });
  const [counts, newest, bankRequests, totals] = await Promise.all([
    countConsoleSchools(supabase),
    listConsoleSchools(supabase, ANY),
    oncePerRequest(request, "bank-requests", () => listBankRequests(supabase)),
    getPaymentTotals(supabase),
  ]);
  return data(
    {
      schools: { ...counts, latest: newest.schools.slice(0, LATEST) },
      bankRequests,
      // Newest month first; the overview shows only this month.
      thisMonth: totals.slice(0, 1),
    },
    { headers },
  );
}

export async function action({ request }: Route.ActionArgs) {
  const staff = await requireStaff(request);
  return consoleAction(staff, await request.formData(), request);
}

function plural(n: number, one: string, many: string) {
  return n === 1 ? one : many;
}

export default function ConsoleOverview({ loaderData }: Route.ComponentProps) {
  if ("gated" in loaderData) return null;
  const { schools, bankRequests, thisMonth } = loaderData;
  const calm = bankRequests.length === 0 && schools.setup === 0;
  return (
    <>
      <PageHeader
        title="Overview"
        description="What needs you first, then how DriveRush is doing."
        actions={
          <Button asChild variant="rush">
            <Link to="/console/schools/new">
              <Icon icon={PlusIcon} size={18} />
              New school
            </Link>
          </Button>
        }
      />

      <Section title="Needs you">
        {calm ? (
          <p className="m-0 rounded-lg border border-dashed border-line px-4 py-5 text-[14px] text-ink-3">
            Nothing is waiting. No bank to check, no school left in set-up.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            <BankRequests requests={bankRequests} />
            {schools.setup > 0 ? (
              <Alert>
                <AlertBody>
                  <AlertTitle>
                    {schools.setup}{" "}
                    {plural(schools.setup, "school is", "schools are")} still
                    being set up
                  </AlertTitle>
                  <AlertDescription>
                    Hidden from everyone until you hand{" "}
                    {plural(schools.setup, "it", "them")} over to{" "}
                    {plural(schools.setup, "its owner", "their owners")}.{" "}
                    <Link
                      to="/console/schools?status=setup"
                      className="font-semibold underline underline-offset-2"
                    >
                      Open the list
                    </Link>
                  </AlertDescription>
                </AlertBody>
              </Alert>
            ) : null}
          </div>
        )}
      </Section>

      <Section title="At a glance">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile
            label="Schools"
            icon={SchoolIcon}
            value={schools.total}
            note={`${schools.active} active`}
            to="/console/schools"
          />
          <StatTile
            label="Setting up"
            icon={SchoolIcon}
            value={schools.setup}
            note="Not handed over yet"
            tone={schools.setup > 0 ? "warn" : "neutral"}
            to="/console/schools?status=setup"
          />
          <StatTile
            label="Sponsoring now"
            icon={StarIcon}
            value={schools.sponsoring}
            note="Cars take turns on the board"
            to="/console/schools?sponsoring=yes"
          />
          <StatTile
            label="Banks to check"
            icon={WalletIcon}
            value={bankRequests.length}
            note="Sent by school owners"
            tone={bankRequests.length > 0 ? "warn" : "neutral"}
            to="/console/payments"
          />
        </div>
      </Section>

      <Section
        title="Money this month"
        actions={<MoreLink to="/console/payments">All payments</MoreLink>}
      >
        {thisMonth.length > 0 ? (
          <PaymentTotalsGrid totals={thisMonth} />
        ) : (
          <p className="m-0 rounded-lg border border-dashed border-line px-4 py-5 text-[14px] text-ink-3">
            No pass has been paid for yet.
          </p>
        )}
      </Section>

      <Section
        title="Newest schools"
        actions={<MoreLink to="/console/schools">All schools</MoreLink>}
      >
        <SchoolList schools={schools.latest} />
      </Section>
    </>
  );
}

function MoreLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Button asChild variant="quiet-rush" size="sm" className="px-0">
      <Link to={to} prefetch="intent">
        {children}
        <Icon icon={ArrowRightIcon} size={14} />
      </Link>
    </Button>
  );
}
