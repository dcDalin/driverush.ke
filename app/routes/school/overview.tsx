/**
 * `/school/:schoolId`: the dashboard's first page. In order:
 *
 *   Get your school ready  (owner, until it is done) DriveRush hands a
 *                          school over with its name and its cars; the owner
 *                          gives it a logo, a profile and a first branch
 *                          (then it is public), a bank and its first
 *                          students. Each step opens the modal that does it.
 *   Needs you              invites that ran out; for an admin, no branch yet
 *   At a glance            the numbers, each linking into its list
 *   Newest students
 */
import { Link } from "react-router";

import { kes } from "~/components/account/pass-offers";
import { Icon } from "~/components/brand/icon";
import {
  ArrowRightIcon,
  CheckIcon,
  ChevronRightIcon,
  LearnerIcon,
  MinusIcon,
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
import { schoolReadiness } from "~/database/schools/readiness";
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

function ReadyStep({
  done,
  label,
  detail,
  to,
  action,
}: {
  done: boolean;
  label: string;
  detail: string;
  to: string;
  action: string;
}) {
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
      <span
        className={
          done
            ? "flex size-6 shrink-0 items-center justify-center rounded-full bg-kenya-green text-kenya-green-foreground"
            : "flex size-6 shrink-0 items-center justify-center rounded-full border border-line text-ink-3"
        }
      >
        <Icon icon={done ? CheckIcon : MinusIcon} size={14} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[14px] font-semibold">{label}</span>
        <span className="text-[13px] text-ink-3">{detail}</span>
      </span>
      {done ? null : (
        <Button asChild size="sm" variant="paper">
          <Link to={to} preventScrollReset>
            {action}
            <Icon icon={ChevronRightIcon} size={14} />
          </Link>
        </Button>
      )}
    </li>
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
  const openBranches = d.branches.filter(
    (b) => b.is_active && d.myBranchIds.includes(b.id),
  );
  const noBranch = openBranches.length === 0;
  // The owner's own list covers the branch and the bank; "Needs you" keeps
  // what is left for them, and everything for an admin.
  const ready = schoolReadiness({
    logo: d.profile?.logo,
    tagline: d.profile?.tagline,
    about: d.profile?.about,
    openBranches: d.branches.filter((b) => b.is_active).length,
  });
  const bankDone = Boolean(d.passInfo?.ready) || bankWaiting;
  const steps = [
    ready.logo,
    ready.profile,
    ready.branch,
    ...(d.paymentsOn ? [bankDone] : []),
    d.students.length > 0,
  ];
  const stepsDone = steps.filter(Boolean).length;
  const gettingReady = d.canManage && stepsDone < steps.length;
  const adminNoBranch = !d.canManage && noBranch;
  const calm = !adminNoBranch && expired === 0;
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

      {gettingReady ? (
        <Section
          title={
            <span className="flex flex-wrap items-center gap-2">
              Get your school ready
              <Badge variant="outline">
                {stepsDone} of {steps.length}
              </Badge>
            </span>
          }
          description={
            ready.ready
              ? "Your school is on DriveRush. Finish the rest to take payments and follow your students."
              : "Your school is not on DriveRush's site or its board yet. It goes on once it has a logo, a profile and an open branch."
          }
        >
          <ul className="m-0 flex list-none flex-col divide-y divide-line rounded-lg border border-line bg-surface p-0">
            <ReadyStep
              done={ready.logo}
              label="Upload your logo"
              detail={
                ready.logo
                  ? "Uploaded."
                  : "Shown beside your name, and on your cars' credits."
              }
              to={to("profile/logo/logo")}
              action="Upload"
            />
            <ReadyStep
              done={ready.profile}
              label="Describe your school"
              detail={
                ready.profile
                  ? "Filled in."
                  : "A tagline, what you teach and how to reach you."
              }
              to={to("profile/edit")}
              action="Write it"
            />
            <ReadyStep
              done={ready.branch}
              label="Add your first branch"
              detail={
                ready.branch
                  ? `${openBranches.length} open.`
                  : "Students and admins belong to a branch."
              }
              to={to("branches/add")}
              action="Add branch"
            />
            {d.paymentsOn ? (
              <ReadyStep
                done={bankDone}
                label="Add your bank"
                detail={
                  d.passInfo?.ready
                    ? "You are being paid."
                    : bankWaiting
                      ? "Sent. DriveRush is checking it."
                      : "So learners can pay through you and you earn from each pass."
                }
                to={to("passes/bank")}
                action="Add bank"
              />
            ) : null}
            <ReadyStep
              done={d.students.length > 0}
              label="Add your first students"
              detail={
                d.students.length > 0
                  ? "Added."
                  : noBranch
                    ? "After your first branch."
                    : "By email. Each one gets a link."
              }
              to={noBranch ? to("branches/add") : to("students/add")}
              action={noBranch ? "Add branch first" : "Add student"}
            />
          </ul>
        </Section>
      ) : null}

      {gettingReady && calm ? null : (
        <Section title="Needs you">
          {calm ? (
            <p className="m-0 rounded-lg border border-dashed border-line px-4 py-5 text-[14px] text-ink-3">
              Nothing is waiting.
              {bankWaiting ? " DriveRush is checking the bank you sent." : ""}
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {adminNoBranch ? (
                <Need title="No branch yet">
                  Students are added to a branch. Ask the school's owner to give
                  you one.
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
                  <Link
                    to={`${to("students")}?sstatus=expired`}
                    className={link}
                  >
                    Send {expired === 1 ? "it" : "them"} again
                  </Link>
                </Need>
              ) : null}
            </div>
          )}
        </Section>
      )}

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
