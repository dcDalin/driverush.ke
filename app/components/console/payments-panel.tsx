/**
 * DriveRush's money in the console (owner, 2026-11-26): banks owners sent,
 * waiting for a check; this month's and last month's totals; and every
 * payment, searched and filtered in the address of `/console/payments`
 * (`?pq=&pstatus=&ppage=`). The overview reuses the banks and the totals.
 */
import { Link } from "react-router";

import { kes } from "~/components/account/pass-offers";
import { Icon } from "~/components/brand/icon";
import { ChevronRightIcon } from "~/components/brand/icons";
import { FilterBar } from "~/components/list/filter-bar";
import { FilterSelect } from "~/components/list/filter-select";
import { PaginationBar } from "~/components/list/pagination-bar";
import { SearchInput } from "~/components/list/search-input";
import {
  Alert,
  AlertBody,
  AlertDescription,
  AlertTitle,
} from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "~/components/ui/item";
import {
  type BankRequest,
  type PaymentRow,
  PAYMENTS_PAGE_SIZE,
  type PaymentTotals,
} from "~/database/billing/school";

const DAY = new Intl.DateTimeFormat("en-KE", {
  timeZone: "Africa/Nairobi",
  day: "numeric",
  month: "short",
});
const MONTH = new Intl.DateTimeFormat("en-KE", {
  timeZone: "UTC",
  month: "long",
  year: "numeric",
});

/** Banks owners sent, at the top of the console until someone checks them. */
export function BankRequests({ requests }: { requests: BankRequest[] }) {
  if (requests.length === 0) return null;
  return (
    <Alert>
      <AlertBody>
        <AlertTitle>
          {requests.length === 1
            ? "1 bank waiting for a check"
            : `${requests.length} banks waiting for a check`}
        </AlertTitle>
        <AlertDescription>
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {requests.map((r) => (
              <li key={r.school_id} className="flex flex-wrap gap-x-1">
                <Link
                  to={`/console/schools/${r.school_id}/payments`}
                  className="font-semibold underline underline-offset-2"
                >
                  {r.school_name}
                </Link>
                <Parts
                  parts={[
                    r.pending_bank_label,
                    r.pending_account_name ?? "",
                    `sent ${DAY.format(new Date(r.requested_at))}`,
                  ]}
                  first={false}
                />
              </li>
            ))}
          </ul>
        </AlertDescription>
      </AlertBody>
    </Alert>
  );
}

function Total({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg border border-line bg-surface p-3 sm:gap-1 sm:p-4">
      <span className="text-[13px] text-ink-3">{label}</span>
      <span className="font-display text-[19px] font-bold sm:text-[22px]">
        {value}
      </span>
      {note ? <span className="text-[13px] text-ink-3">{note}</span> : null}
    </div>
  );
}

export function PaymentTotalsGrid({ totals }: { totals: PaymentTotals[] }) {
  return (
    <div className="flex flex-col gap-3">
      {totals.map((t) => (
        <section key={t.month} className="flex flex-col gap-2">
          <h3 className="m-0 text-[13px] font-semibold text-ink-2">
            {MONTH.format(new Date(t.month))}
          </h3>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <Total
              label="Learners paid"
              value={kes(Number(t.paid_kes))}
              note={`${t.payments} ${Number(t.payments) === 1 ? "pass" : "passes"}${Number(t.refunded) ? `, ${t.refunded} refunded` : ""}`}
            />
            <Total
              label="DriveRush kept"
              value={kes(Number(t.driverush_kes))}
            />
            <Total label="Schools earned" value={kes(Number(t.schools_kes))} />
            <Total
              label="Paystack fees"
              value={kes(Math.round(Number(t.fees_kes)))}
            />
          </div>
        </section>
      ))}
      <p className="m-0 text-[13px] text-ink-3">
        On a school pass, Paystack's fee comes out of the school's share.
      </p>
    </div>
  );
}

const STATUS_OPTIONS = [
  { value: "all", label: "Any status" },
  { value: "succeeded", label: "Paid" },
  { value: "pending", label: "Started, not paid" },
  { value: "failed", label: "Failed" },
  { value: "refunded", label: "Refunded" },
] as const;

const STATUS_BADGE = {
  succeeded: "green",
  pending: "outline",
  failed: "default",
  refunded: "amber",
} as const;

const PLAN_LABEL: Record<string, string> = {
  learner_pass: "Own pass",
  school_pass: "Through a school",
  learner_extension: "30 more days",
};

export function PaymentList({
  rows,
  total,
  page,
}: {
  rows: PaymentRow[];
  total: number;
  page: number;
}) {
  return (
    <div className="flex flex-col gap-3">
      <FilterBar
        params={["pq", "pstatus"]}
        pageKey="ppage"
        search={
          <SearchInput
            param="pq"
            pageKey="ppage"
            placeholder="Search by email, school or reference"
          />
        }
        summary={`${total} ${total === 1 ? "payment" : "payments"}`}
      >
        <FilterSelect
          param="pstatus"
          pageKey="ppage"
          label="Payment status"
          options={STATUS_OPTIONS}
        />
      </FilterBar>
      {rows.length === 0 ? (
        <p className="m-0 rounded-lg border border-dashed border-line px-4 py-8 text-center text-[14px] text-ink-3">
          No payment matches.
        </p>
      ) : (
        <>
          <ItemGroup className="rounded-lg border border-line bg-surface">
            {rows.map((r, i) => (
              <Item
                key={r.id}
                asChild={Boolean(r.school_id)}
                className={
                  i > 0 ? "rounded-none border-t border-line" : "rounded-none"
                }
              >
                {r.school_id ? (
                  <Link to={`/console/schools/${r.school_id}/payments`}>
                    <PaymentRowContent row={r} />
                  </Link>
                ) : (
                  <div>
                    <PaymentRowContent row={r} />
                  </div>
                )}
              </Item>
            ))}
          </ItemGroup>
          <PaginationBar
            page={page}
            pageSize={PAYMENTS_PAGE_SIZE}
            totalCount={total}
            pageKey="ppage"
            noun={["payment", "payments"]}
          />
        </>
      )}
    </div>
  );
}

/** Parts of a line, each wrapping whole on a phone, never mid-phrase. */
function Parts({ parts, first = true }: { parts: string[]; first?: boolean }) {
  return parts.filter(Boolean).map((part, i) => (
    <span key={i} className="max-w-full truncate">
      {i > 0 || !first ? "· " : ""}
      {part}
    </span>
  ));
}

function PaymentRowContent({ row }: { row: PaymentRow }) {
  return (
    <>
      <ItemContent>
        <ItemTitle className="flex flex-wrap items-center gap-2">
          {kes(row.amount_kes)}
          <Badge variant={STATUS_BADGE[row.status]}>
            {STATUS_OPTIONS.find((o) => o.value === row.status)?.label ??
              row.status}
          </Badge>
          <span className="font-normal text-ink-3">
            {PLAN_LABEL[row.plan_code] ?? row.plan_code}
          </span>
        </ItemTitle>
        <ItemDescription className="flex flex-wrap gap-x-1">
          <Parts
            parts={[
              DAY.format(new Date(row.settled_at ?? row.created_at)),
              row.payer_email ?? "Deleted account",
              row.school_name ?? "",
              row.school_name ? `school ${kes(row.school_share_kes)}` : "",
              row.school_name
                ? `DriveRush ${kes(row.driverush_share_kes)}`
                : "",
              row.fee_kes ? `fee ${kes(Math.round(Number(row.fee_kes)))}` : "",
            ]}
          />
          <span className="max-w-full truncate">
            · <span className="font-mono">{row.provider_ref}</span>
          </span>
        </ItemDescription>
      </ItemContent>
      {row.school_id ? (
        <ItemActions>
          <Icon icon={ChevronRightIcon} size={18} className="text-ink-3" />
        </ItemActions>
      ) : null}
    </>
  );
}
