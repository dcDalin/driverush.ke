/**
 * `/console`: DriveRush staff (su and admin, on a password session).
 *
 *   Schools  every school, a page at a time: search by name, short name or
 *            owner's email; filter by status, livery and sponsorship (all in
 *            the address). "New school" creates one for an owner's email,
 *            or with none to set it up privately first. Each row opens the
 *            school's page (`/console/schools/:schoolId`): set-up, hand-over,
 *            liveries, sponsorship, payments.
 *   Payments every payment (search, status, pages) and the month's totals.
 *   Staff    (su only) who holds a staff role; grant or revoke by email.
 * Above the tabs: banks school owners sent, waiting for a check.
 * The tab is kept in the address (`?tab=payments`).
 *
 * Changes go through `consoleAction` (shared with the school's page); the
 * database checks every call again (private.is_staff, private.is_su).
 */
import { data } from "react-router";

import { SiteNav } from "~/components/brand/site-nav";
import { StaffPanel } from "~/components/console/console-panels";
import { CreateSchoolDialog } from "~/components/console/create-school-dialog";
import {
  BankRequests,
  PaymentList,
  PaymentTotalsGrid,
} from "~/components/console/payments-panel";
import { SchoolFilters, SchoolList } from "~/components/console/school-list";
import { PaginationBar } from "~/components/list/pagination-bar";
import { NeedsSignIn, NothingHere } from "~/components/school/signed-out";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { isStaffRole, isSuRole } from "~/database/auth/roles";
import {
  getPaymentTotals,
  listBankRequests,
  listPayments,
  PAYMENTS_PAGE_SIZE,
} from "~/database/billing/school";
import {
  CONSOLE_PAGE_SIZE,
  listConsoleSchools,
  listStaff,
} from "~/database/console/queries";
import { getRequestClient, requireStaff } from "~/lib/auth/require.server";
import { consoleAction } from "~/lib/console/action.server";
import { useLiveRevalidate } from "~/lib/realtime/use-live-revalidate";
import { useTabParam } from "~/lib/ui/use-tab-param";
import { PaymentFiltersSchema } from "~/schemas/billing";
import { SchoolFiltersSchema } from "~/schemas/console";

import type { Route } from "./+types/console";

export function meta() {
  return [
    { title: "Console | DriveRush" },
    { name: "robots", content: "noindex" },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const { supabase, headers, caller } = await getRequestClient(request);
  if (!caller.signedIn)
    return data({ state: "signed-out" as const }, { headers });
  if (!isStaffRole(caller.role))
    return data({ state: "not-staff" as const }, { headers });
  const su = isSuRole(caller.role);
  const search = new URL(request.url).searchParams;
  const params = Object.fromEntries(search);
  const filters = SchoolFiltersSchema.parse(params);
  const payFilters = PaymentFiltersSchema.parse({
    q: params.pq,
    status: params.pstatus,
    page: params.ppage,
  });
  const onPayments = search.get("tab") === "payments";
  const [list, staff, bankRequests, totals, payments] = await Promise.all([
    listConsoleSchools(supabase, {
      search: filters.q,
      status: filters.status,
      livery: filters.livery,
      sponsoring: filters.sponsoring,
      page: filters.page,
    }),
    su ? listStaff(supabase) : Promise.resolve([]),
    listBankRequests(supabase),
    onPayments ? getPaymentTotals(supabase) : Promise.resolve([]),
    onPayments
      ? listPayments(supabase, payFilters)
      : Promise.resolve({ rows: [], total: 0 }),
  ]);
  const paymentPages = Math.max(
    1,
    Math.ceil(payments.total / PAYMENTS_PAGE_SIZE),
  );
  return data(
    {
      state: "ok" as const,
      su,
      me: caller.userId,
      page: Math.min(filters.page, list.pages),
      ...list,
      staff,
      bankRequests,
      totals,
      payments: {
        ...payments,
        page: Math.min(payFilters.page, paymentPages),
        pages: paymentPages,
      },
    },
    { headers },
  );
}

export async function action({ request }: Route.ActionArgs) {
  const staff = await requireStaff(request);
  return consoleAction(staff, await request.formData(), request);
}

const CONSOLE_TABS = ["schools", "payments", "staff"] as const;

export default function Console({ loaderData }: Route.ComponentProps) {
  const [tab, setTab] = useTabParam(CONSOLE_TABS);
  useLiveRevalidate(loaderData.state === "ok" ? ["console"] : []);
  return (
    <>
      <SiteNav />
      <main className="mx-auto min-h-screen w-full max-w-5xl px-5 pb-24 text-ink sm:px-9">
        {loaderData.state === "signed-out" ? (
          <NeedsSignIn
            title="Console"
            body="For DriveRush staff. Sign in with your email and password."
          />
        ) : loaderData.state === "not-staff" ? (
          <NothingHere
            title="Staff only"
            body="This account has no DriveRush staff role, or signed in with a code. Staff sign in with a password."
          />
        ) : (
          <div className="flex flex-col gap-6 py-10">
            <header className="flex flex-wrap items-center justify-between gap-3">
              <h1 className="font-display text-[28px] font-bold tracking-tight">
                Console
              </h1>
              <CreateSchoolDialog />
            </header>
            <BankRequests requests={loaderData.bankRequests} />
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList>
                <TabsTrigger value="schools">Schools</TabsTrigger>
                <TabsTrigger value="payments">Payments</TabsTrigger>
                {loaderData.su ? (
                  <TabsTrigger value="staff">Staff</TabsTrigger>
                ) : null}
              </TabsList>
              <TabsContent value="schools" className="flex flex-col gap-4 pt-4">
                <SchoolFilters total={loaderData.total} />
                <SchoolList schools={loaderData.schools} />
                <PaginationBar
                  page={loaderData.page}
                  pageSize={CONSOLE_PAGE_SIZE}
                  totalCount={loaderData.total}
                  noun={["school", "schools"]}
                />
              </TabsContent>
              <TabsContent
                value="payments"
                className="flex flex-col gap-6 pt-4"
              >
                <PaymentTotalsGrid totals={loaderData.totals} />
                <PaymentList
                  rows={loaderData.payments.rows}
                  total={loaderData.payments.total}
                  page={loaderData.payments.page}
                />
              </TabsContent>
              {loaderData.su ? (
                <TabsContent value="staff" className="pt-4">
                  <StaffPanel staff={loaderData.staff} me={loaderData.me} />
                </TabsContent>
              ) : null}
            </Tabs>
          </div>
        )}
      </main>
    </>
  );
}
