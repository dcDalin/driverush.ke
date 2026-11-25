/**
 * The owner's view of the school's team: the owner, up to 50 admins (each tied
 * to one or more branches), and admins invited by an email that has not
 * signed up yet (they count toward the 50).
 */
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";

import { useActionForm } from "./action-form";

type Branch = { id: string; name: string };
type Member = {
  member_id: string;
  email: string | null;
  full_name: string | null;
  role: "owner" | "admin";
  branch_ids: string[];
};
type Invite = {
  id: string;
  email: string;
  role: "owner" | "admin";
  branch_ids: string[];
};

export const MAX_ADMINS = 50;

function BranchBoxes({
  branches,
  checked,
  prefix,
}: {
  branches: Branch[];
  checked: string[];
  prefix: string;
}) {
  return (
    <div className="flex flex-wrap gap-3">
      {branches.map((b) => (
        <label
          key={b.id}
          htmlFor={`${prefix}-${b.id}`}
          className="flex items-center gap-2 text-[14px]"
        >
          <Checkbox
            id={`${prefix}-${b.id}`}
            name="branchIds"
            value={b.id}
            defaultChecked={checked.includes(b.id)}
          />
          {b.name}
        </label>
      ))}
    </div>
  );
}

export function TeamPanel({
  team,
  invites,
  branches,
}: {
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
      <div className="flex items-end justify-between gap-3">
        <h2 className="font-display text-[20px] font-bold">Team</h2>
        <p className="text-[13px] text-ink-3">
          {admins} of {MAX_ADMINS} admins
        </p>
      </div>
      {branches.length > 0 && admins < MAX_ADMINS && (
        <AddAdmin branches={branches} />
      )}
      <ul className="flex flex-col divide-y divide-line rounded-lg border border-line bg-surface">
        {team.map((m) => (
          <MemberItem
            key={m.member_id}
            member={m}
            branches={branches}
            branchNames={names(m.branch_ids)}
          />
        ))}
        {invites.map((i) => (
          <InviteItem key={i.id} invite={i} branchNames={names(i.branch_ids)} />
        ))}
      </ul>
    </section>
  );
}

function AddAdmin({ branches }: { branches: Branch[] }) {
  const { Form, busy } = useActionForm();
  return (
    <Form
      method="post"
      className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4"
    >
      <input type="hidden" name="intent" value="add-admin" />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="admin-email">Admin's email</Label>
        <Input
          id="admin-email"
          name="email"
          type="email"
          required
          placeholder="name@school.co.ke"
          disabled={busy}
        />
      </div>
      <BranchBoxes
        branches={branches}
        checked={branches.length === 1 ? [branches[0].id] : []}
        prefix="new-admin"
      />
      <Button
        type="submit"
        variant="rush"
        className="self-start"
        disabled={busy}
      >
        Add admin
      </Button>
    </Form>
  );
}

function MemberItem({
  member,
  branches,
  branchNames,
}: {
  member: Member;
  branches: Branch[];
  branchNames: string;
}) {
  const { Form, busy } = useActionForm();
  return (
    <li className="flex flex-col gap-2 px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">
          {member.full_name ?? member.email}
        </span>
        <Badge variant={member.role === "owner" ? "ink" : "outline"}>
          {member.role}
        </Badge>
      </div>
      <p className="text-[13px] text-ink-3">
        {member.full_name ? member.email : ""}
        {member.role === "owner"
          ? " · every branch"
          : branchNames
            ? ` · ${branchNames}`
            : ""}
      </p>
      {member.role === "admin" && (
        <div className="flex flex-wrap items-start gap-3">
          <Form method="post" className="flex flex-col gap-2">
            <input type="hidden" name="intent" value="set-admin-branches" />
            <input type="hidden" name="memberId" value={member.member_id} />
            <BranchBoxes
              branches={branches}
              checked={member.branch_ids}
              prefix={member.member_id}
            />
            <Button
              type="submit"
              size="sm"
              variant="paper"
              className="self-start"
              disabled={busy}
            >
              Save branches
            </Button>
          </Form>
          <Form method="post">
            <input type="hidden" name="intent" value="remove-admin" />
            <input type="hidden" name="memberId" value={member.member_id} />
            <Button type="submit" size="sm" variant="ghost" disabled={busy}>
              Remove
            </Button>
          </Form>
        </div>
      )}
    </li>
  );
}

function InviteItem({
  invite,
  branchNames,
}: {
  invite: Invite;
  branchNames: string;
}) {
  const { Form, busy } = useActionForm();
  return (
    <li className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-semibold">{invite.email}</p>
        <p className="text-[13px] text-ink-3">
          Invited {invite.role}, not signed up yet
          {branchNames ? ` · ${branchNames}` : ""}
        </p>
      </div>
      <Form method="post">
        <input type="hidden" name="intent" value="cancel-invite" />
        <input type="hidden" name="inviteId" value={invite.id} />
        <Button type="submit" size="sm" variant="ghost" disabled={busy}>
          Withdraw
        </Button>
      </Form>
    </li>
  );
}
