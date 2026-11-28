/**
 * `/console/payments`: DriveRush's money. Banks school owners sent, waiting
 * for a check; this month's and last month's totals; and every payment,
 * searched and filtered in the address (`?pq=&pstatus=&ppage=`).
 */
import { data } from "react-router";

import {
  BankRequests,
  PaymentList,
  PaymentTotalsGrid,
} from "~/components/console/payments-panel";
import { PageHeader, Section } from "~/components/console/shell";
import {
  getPaymentTotals,
  listBankRequests,
  listPayments,
  PAYMENTS_PAGE_SIZE,
} from "~/database/billing/school";
import { getRequestClient, requireStaff } from "~/lib/auth/require.server";
import { consoleAction } from "~/lib/console/action.server";
import { consoleGate, GATED } from "~/lib/console/gate.server";
import { oncePerRequest } from "~/lib/server/once-per-request";
import { PaymentFiltersSchema } from "~/schemas/billing";

import type { Route } from "./+types/payments";

export function meta() {
  return [
    { title: "Payments | Console | DriveRush" },
    { name: "robots", content: "noindex" },
  ];
}

export async function loader({ request, url }: Route.LoaderArgs) {
  const context = await getRequestClient(request);
  const gate = await consoleGate(context);
  const { supabase, headers } = context;
  if (!gate.ok) return data(GATED, { headers });
  const params = Object.fromEntries(url.searchParams);
  const filters = PaymentFiltersSchema.parse({
    q: params.pq,
    status: params.pstatus,
    page: params.ppage,
  });
  const [bankRequests, totals, payments] = await Promise.all([
    oncePerRequest(request, "bank-requests", () => listBankRequests(supabase)),
    getPaymentTotals(supabase),
    listPayments(supabase, filters),
  ]);
  const pages = Math.max(1, Math.ceil(payments.total / PAYMENTS_PAGE_SIZE));
  return data(
    {
      bankRequests,
      totals,
      payments: { ...payments, page: Math.min(filters.page, pages) },
    },
    { headers },
  );
}

export async function action({ request }: Route.ActionArgs) {
  const staff = await requireStaff(request);
  return consoleAction(staff, await request.formData(), request);
}

export default function ConsolePayments({ loaderData }: Route.ComponentProps) {
  if ("gated" in loaderData) return null;
  const { bankRequests, totals, payments } = loaderData;
  return (
    <>
      <PageHeader
        title="Payments"
        description="Passes learners paid for, what DriveRush kept and what schools earned."
      />
      <BankRequests requests={bankRequests} />
      <Section title="Totals">
        <PaymentTotalsGrid totals={totals} />
      </Section>
      <Section title="Every payment">
        <PaymentList
          rows={payments.rows}
          total={payments.total}
          page={payments.page}
        />
      </Section>
    </>
  );
}
