/**
 * The owner's view of the school's team: the owner, up to 50 admins (each tied
 * to one or more branches), and admins invited by an email that has not
 * signed up yet (they count toward the 50; their email can be sent again).
 * Everyone added is emailed a link to the dashboard. "Add admin" is the
 * `team/add` modal route.
 */
import { Link } from "react-router";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import type { SchoolDashboard } from "~/database/schools/dashboard";
import { useInlineAction } from "~/lib/forms/use-inline-action";
import { schoolPath } from "~/lib/school/nav";
import { MAX_SENDS } from "~/lib/school/student-filters";

type Branch = { id: string; name: string };
type Member = SchoolDashboard["team"][number];
type Invite = SchoolDashboard["invites"][number];

export const MAX_ADMINS = 50;

const SINCE = new Intl.DateTimeFormat("en-KE", {
  day: "numeric",
  month: "short",
});

export function TeamPanel({
  schoolId,
  team,
  invites,
  branches,
}: {
  schoolId: string;
  team: Member[];
  invites: Invite[];
  branches: Branch[];
}) {
  const admins =
    team.filter((m) => m.role === "admin").length +
    invites.filter((i) => i.role === "admin").length;
  const names = (ids: string[]) =>
    ids
      .map((id) => branches.find((b) => b.id === id)?.name)
      .filter(Boolean)
      .join(", ");
  return (
    <section className="flex flex-col gap-4">
      <h2 className="sr-only">Team</h2>
      <p className="m-0 text-[13px] text-ink-3">
        {admins} of {MAX_ADMINS} admins
      </p>
      <ul className="flex flex-col divide-y divide-line rounded-lg border border-line bg-surface">
        {team.map((m) => (
          <MemberItem
            key={`${m.member_id}:${m.branch_ids.join(",")}`}
            member={m}
            branchNames={names(m.branch_ids)}
            schoolId={schoolId}
          />
        ))}
        {invites.map((i) => (
          <InviteItem
            key={i.id}
            invite={i}
            branchNames={names(i.branch_ids)}
            schoolId={schoolId}
          />
        ))}
      </ul>
    </section>
  );
}

function MemberItem({
  member,
  branchNames,
  schoolId,
}: {
  member: Member;
  branchNames: string;
  schoolId: string;
}) {
  const ask = (verb: "branches" | "remove") =>
    schoolPath(schoolId, `team/${member.member_id}/${verb}`);
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <p className="m-0 flex flex-wrap items-center gap-2">
          <span className="font-semibold">
            {member.full_name ?? member.email}
          </span>
          <Badge variant={member.role === "owner" ? "ink" : "outline"}>
            {member.role}
          </Badge>
        </p>
        <p className="m-0 text-[13px] text-ink-3">
          {member.full_name ? `${member.email} · ` : ""}
          {member.role === "owner"
            ? "every branch"
            : branchNames || "no branch yet"}
        </p>
      </div>
      {member.role === "admin" && (
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" variant="paper">
            <Link to={ask("branches")} preventScrollReset>
              Change branches
            </Link>
          </Button>
          <Button asChild size="sm" variant="ghost">
            <Link to={ask("remove")} preventScrollReset>
              Remove
            </Link>
          </Button>
        </div>
      )}
    </li>
  );
}

function InviteItem({
  invite,
  branchNames,
  schoolId,
}: {
  invite: Invite;
  branchNames: string;
  schoolId: string;
}) {
  const { busy, pending, submit } = useInlineAction(`invite:${invite.id}`);
  return (
    <li className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-semibold">{invite.email}</p>
        <p className="flex flex-wrap items-center gap-x-2 text-[13px] text-ink-3">
          {invite.expired ? (
            <Badge variant="outline">Invite expired</Badge>
          ) : null}
          Invited {invite.role}, not signed up yet. Sent {invite.sent_count} of{" "}
          {MAX_SENDS} times, last {SINCE.format(new Date(invite.last_sent_at))}
          {branchNames ? ` · ${branchNames}` : ""}
        </p>
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant={invite.expired ? "rush" : "paper"}
          disabled={busy || invite.sent_count >= MAX_SENDS}
          isLoading={pending === "resend-invite"}
          title={
            invite.sent_count >= MAX_SENDS
              ? "Sent 5 times: withdraw it, then add them again"
              : undefined
          }
          onClick={() =>
            submit({ intent: "resend-invite", inviteId: invite.id })
          }
        >
          {invite.expired ? "Send again" : "Email again"}
        </Button>
        <Button asChild size="sm" variant="ghost">
          <Link
            to={schoolPath(schoolId, `team/invites/${invite.id}/withdraw`)}
            preventScrollReset
          >
            Withdraw
          </Link>
        </Button>
      </div>
    </li>
  );
}
