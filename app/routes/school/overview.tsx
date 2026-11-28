/**
 * `/school/:schoolId`: the dashboard's first page. In order: what is
 * waiting for someone (no bank, no branch, invites that ran out), the
 * numbers with a link into the list behind each, and the newest students.
 */
import { Link } from "react-router";

import { kes } from "~/components/account/pass-offers";
import { Icon } from "~/components/brand/icon";
import {
  ArrowRightIcon,
  LearnerIcon,
  PlusIcon,
  StarIcon,
  WalletIcon,
} from "~/components/brand/icons";
import { PageHeader, Section, StatTile } from "~/components/console/shell";
import {
  Alert,
  AlertBody,
  AlertDescription,
  AlertTitle,
} from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { earningsTotals } from "~/database/billing/school";
import { requireUser } from "~/lib/auth/require.server";
import { schoolAction } from "~/lib/school/action.server";
import { schoolPath } from "~/lib/school/nav";
import { useSchool } from "~/lib/school/use-school";

import type { Route } from "./+types/overview";

export async function action({ request, params }: Route.ActionArgs) {
  const context = await requireUser(request);
  return schoolAction(context, params.schoolId, request);
}

const LATEST = 5;
const link = "font-semibold underline underline-offset-2";

function Need({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Alert>
      <AlertBody>
        <AlertTitle>{title}</AlertTitle>
        <AlertDescription>{children}</AlertDescription>
      </AlertBody>
    </Alert>
  );
}

export default function SchoolOverview() {
  const d = useSchool();
  const to = (page = "") => schoolPath(d.school.id, page);
  const active = d.students.filter((s) => s.status === "active");
  const waiting = d.students.filter(
    (s) => s.status === "pending" && !s.inviteExpired,
  ).length;
  const expired = d.students.filter((s) => s.inviteExpired).length;
  const paid = active.filter((s) => s.passEndsAt).length;
  const earned = earningsTotals(d.earnings).thisMonth;
  const bankWaiting = Boolean(d.passInfo?.pending_bank_label);
  const bankNeeded = d.canManage && !d.passInfo?.ready && !bankWaiting;
  const openBranches = d.branches.filter(
    (b) => b.is_active && d.myBranchIds.includes(b.id),
  );
  const noBranch = openBranches.length === 0;
  const calm = !bankNeeded && !noBranch && expired === 0;
  const latest = [...d.students]
    .sort((a, b) => (b.addedAt ?? "").localeCompare(a.addedAt ?? ""))
    .slice(0, LATEST);
  const branchName = (id: string) =>
    d.branches.find((b) => b.id === id)?.name ?? "";

  return (
    <>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            {d.school.name}
            <Badge variant={d.role === "owner" ? "ink" : "outline"}>
              {d.role}
            </Badge>
            {d.school.status !== "active" && (
              <Badge variant="amber">{d.school.status}</Badge>
            )}
          </span>
        }
        description="What needs you first, then how your students are doing."
        actions={
          noBranch ? null : (
            <Button asChild variant="rush">
              <Link to={to("students/add")}>
                <Icon icon={PlusIcon} size={18} />
                Add student
              </Link>
            </Button>
          )
        }
      />

      <Section title="Needs you">
        {calm ? (
          <p className="m-0 rounded-lg border border-dashed border-line px-4 py-5 text-[14px] text-ink-3">
            Nothing is waiting.
            {bankWaiting ? " DriveRush is checking the bank you sent." : ""}
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {noBranch ? (
              <Need title="Add a branch first">
                Students are added to a branch.{" "}
                {d.canManage ? (
                  <Link to={to("branches/add")} className={link}>
                    Add your first branch
                  </Link>
                ) : (
                  "Ask the school's owner to give you one."
                )}
              </Need>
            ) : null}
            {bankNeeded ? (
              <Need title="Add your bank to get paid">
                Learners can pay through your school once DriveRush has checked
                your bank.{" "}
                <Link to={to("passes")} className={link}>
                  Add it on Passes
                </Link>
              </Need>
            ) : null}
            {expired > 0 ? (
              <Need
                title={
                  expired === 1
                    ? "1 invite has run out"
                    : `${expired} invites have run out`
                }
              >
                An invite lasts 30 days.{" "}
                <Link to={`${to("students")}?sstatus=expired`} className={link}>
                  Send {expired === 1 ? "it" : "them"} again
                </Link>
              </Need>
            ) : null}
          </div>
        )}
      </Section>

      <Section title="At a glance">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile
            label="Students"
            icon={LearnerIcon}
            value={active.length}
            note="With you this month"
            to={`${to("students")}?sstatus=active`}
          />
          <StatTile
            label="With a pass"
            icon={StarIcon}
            value={paid}
            note={`${active.length - paid} without one yet`}
            to={`${to("students")}?sstatus=paid`}
          />
          <StatTile
            label="Waiting to join"
            icon={LearnerIcon}
            value={waiting}
            note="Invited, not signed in yet"
            to={`${to("students")}?sstatus=pending`}
          />
          <StatTile
            label="Earned this month"
            icon={WalletIcon}
            value={kes(earned.kes)}
            note={`${earned.learners} ${earned.learners === 1 ? "learner" : "learners"} paid through you`}
            to={to("passes")}
          />
        </div>
      </Section>

      <Section
        title="Newest students"
        actions={
          <Button asChild variant="quiet-rush" size="sm" className="px-0">
            <Link to={to("students")} prefetch="intent">
              All students
              <Icon icon={ArrowRightIcon} size={14} />
            </Link>
          </Button>
        }
      >
        {latest.length === 0 ? (
          <p className="m-0 rounded-lg border border-dashed border-line px-4 py-5 text-[14px] text-ink-3">
            No students yet. Add this week's class by email: each one gets an
            email with a link.
          </p>
        ) : (
          <ul className="m-0 flex list-none flex-col divide-y divide-line rounded-lg border border-line bg-surface p-0">
            {latest.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
              >
                <span className="min-w-0">
                  <span className="block truncate font-semibold">
                    {s.name ?? s.email}
                  </span>
                  <span className="block truncate text-[13px] text-ink-3">
                    {s.name ? `${s.email} · ` : ""}
                    {branchName(s.branchId)}
                  </span>
                </span>
                {s.inviteExpired ? (
                  <Badge variant="outline">Invite expired</Badge>
                ) : s.status === "pending" ? (
                  <Badge variant="amber">Waiting for them</Badge>
                ) : s.status === "active" ? (
                  <Badge variant="green">With you</Badge>
                ) : (
                  <Badge variant="outline">Month over</Badge>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}
