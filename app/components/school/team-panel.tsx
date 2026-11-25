/**
 * The owner's view of the school's team: the owner, up to 50 admins (each tied
 * to one or more branches), and admins invited by an email that has not
 * signed up yet (they count toward the 50).
 */
import { HoneypotInputs } from "remix-utils/honeypot/react";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  CheckboxGroupField,
  InputField,
  ServerFormProvider,
} from "~/components/ui/forms/server";
import type { SchoolDashboard } from "~/database/schools/dashboard";
import { useInlineAction } from "~/lib/forms/use-inline-action";
import { useServerForm } from "~/lib/forms/use-server-form";
import { AddAdminSchema, SetAdminBranchesSchema } from "~/schemas/school";

type Branch = { id: string; name: string };
type Member = SchoolDashboard["team"][number];
type Invite = SchoolDashboard["invites"][number];

export const MAX_ADMINS = 50;

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
  const options = branches.map((b) => ({ label: b.name, value: b.id }));
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
        <AddAdmin
          options={options}
          onlyBranch={branches.length === 1 ? branches[0]?.id : undefined}
        />
      )}
      <ul className="flex flex-col divide-y divide-line rounded-lg border border-line bg-surface">
        {team.map((m) => (
          <MemberItem
            key={`${m.member_id}:${m.branch_ids.join(",")}`}
            member={m}
            options={options}
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

function AddAdmin({
  options,
  onlyBranch,
}: {
  options: { label: string; value: string }[];
  onlyBranch?: string;
}) {
  const { methods, fetcher, formRef, busy } = useServerForm({
    schema: AddAdminSchema,
    key: "add-admin",
    resetOnSuccess: true,
    defaultValues: {
      intent: "add-admin",
      email: "",
      branchIds: onlyBranch ? [onlyBranch] : [],
    },
  });
  return (
    <ServerFormProvider methods={methods}>
      <fetcher.Form
        ref={formRef}
        method="post"
        onSubmit={methods.handleSubmit}
        noValidate
        className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4"
      >
        <HoneypotInputs />
        <InputField
          name="email"
          label="Admin's email"
          disabled={busy}
          inputProps={{
            type: "email",
            inputMode: "email",
            placeholder: "name@school.co.ke",
          }}
        />
        <CheckboxGroupField
          name="branchIds"
          label="Branches"
          options={options}
          disabled={busy}
        />
        <Button
          type="submit"
          variant="rush"
          className="self-start"
          isLoading={busy}
        >
          Add admin
        </Button>
      </fetcher.Form>
    </ServerFormProvider>
  );
}

function MemberItem({
  member,
  options,
  branchNames,
}: {
  member: Member;
  options: { label: string; value: string }[];
  branchNames: string;
}) {
  const remove = useInlineAction(`member:${member.member_id}`);
  const branches = useServerForm({
    schema: SetAdminBranchesSchema,
    key: `admin-branches:${member.member_id}`,
    defaultValues: {
      intent: "set-admin-branches",
      memberId: member.member_id,
      branchIds: member.branch_ids,
    },
  });
  return (
    <li
      className="flex flex-col gap-2 px-4 py-3"
      aria-busy={remove.busy || undefined}
    >
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
          <ServerFormProvider methods={branches.methods}>
            <branches.fetcher.Form
              ref={branches.formRef}
              method="post"
              onSubmit={branches.methods.handleSubmit}
              noValidate
              className="flex flex-col gap-2"
            >
              <HoneypotInputs />
              <CheckboxGroupField
                name="branchIds"
                label="Branches"
                options={options}
                disabled={branches.busy}
              />
              <Button
                type="submit"
                size="sm"
                variant="paper"
                className="self-start"
                isLoading={branches.busy}
              >
                Save branches
              </Button>
            </branches.fetcher.Form>
          </ServerFormProvider>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={remove.busy}
            isLoading={remove.pending === "remove-admin"}
            onClick={() =>
              remove.submit({
                intent: "remove-admin",
                memberId: member.member_id,
              })
            }
          >
            Remove
          </Button>
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
  const { busy, pending, submit } = useInlineAction(`invite:${invite.id}`);
  return (
    <li className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-semibold">{invite.email}</p>
        <p className="text-[13px] text-ink-3">
          Invited {invite.role}, not signed up yet
          {branchNames ? ` · ${branchNames}` : ""}
        </p>
      </div>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        disabled={busy}
        isLoading={pending === "cancel-invite"}
        onClick={() => submit({ intent: "cancel-invite", inviteId: invite.id })}
      >
        Withdraw
      </Button>
    </li>
  );
}
