/**
 * The console's forms and rows (`/console`): server forms (remix-hook-form
 * with a keyed fetcher, `useServerForm`) for anything with fields, keyed
 * inline actions (`useInlineAction`) for one-tap changes.
 */
import * as React from "react";
import { Link } from "react-router";
import { HoneypotInputs } from "remix-utils/honeypot/react";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  InputField,
  SelectField,
  ServerFormProvider,
} from "~/components/ui/forms/server";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import type { ConsoleSchool, StaffMember } from "~/database/console/queries";
import type { SchoolStatus } from "~/database/types";
import { useInlineAction } from "~/lib/forms/use-inline-action";
import { useServerForm } from "~/lib/forms/use-server-form";
import {
  CreateSchoolSchema,
  GrantRoleSchema,
  NO_LIVERY,
  TransferOwnerSchema,
} from "~/schemas/console";

export function CreateSchool({
  sponsors,
}: {
  sponsors: { id: string; school: string }[];
}) {
  const { methods, fetcher, formRef, busy } = useServerForm({
    schema: CreateSchoolSchema,
    key: "create-school",
    resetOnSuccess: true,
    defaultValues: {
      intent: "create-school",
      name: "",
      slug: "",
      ownerEmail: "",
      sponsorId: NO_LIVERY,
    },
  });
  return (
    <ServerFormProvider methods={methods}>
      <fetcher.Form
        ref={formRef}
        method="post"
        onSubmit={methods.handleSubmit}
        noValidate
        className="grid gap-3 rounded-lg border border-line bg-surface p-4 sm:grid-cols-2"
      >
        <HoneypotInputs />
        <InputField
          name="name"
          label="School name"
          disabled={busy}
          inputProps={{ placeholder: "Heltz Driving School" }}
        />
        <InputField
          name="slug"
          label="Short name (for links)"
          disabled={busy}
          inputProps={{ placeholder: "heltz" }}
        />
        <InputField
          name="ownerEmail"
          label="Owner's email"
          disabled={busy}
          inputProps={{
            type: "email",
            inputMode: "email",
            placeholder: "owner@school.co.ke",
          }}
        />
        <SelectField
          name="sponsorId"
          label="Livery"
          disabled={busy}
          options={[
            { label: "None yet (plain cars)", value: NO_LIVERY },
            ...sponsors.map((s) => ({ label: s.school, value: s.id })),
          ]}
        />
        <Button
          type="submit"
          variant="rush"
          className="self-start sm:col-span-2"
          isLoading={busy}
        >
          Create school
        </Button>
      </fetcher.Form>
    </ServerFormProvider>
  );
}

const STATUS_BADGE = {
  active: "green",
  suspended: "amber",
  archived: "outline",
} as const;

/** "1 branch", "2 branches". */
function count(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

export function SchoolRow({ school }: { school: ConsoleSchool }) {
  const status = useInlineAction(`school-status:${school.id}`);
  const [next, setNext] = React.useState<SchoolStatus>(school.status);
  const owner = useServerForm({
    schema: TransferOwnerSchema,
    key: `transfer-owner:${school.id}`,
    resetOnSuccess: true,
    defaultValues: { intent: "transfer-owner", schoolId: school.id, email: "" },
  });
  return (
    <li className="flex flex-col gap-3 px-4 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <Link
          to={`/school/${school.id}`}
          className="font-semibold underline-offset-4 hover:underline"
        >
          {school.name}
        </Link>
        <Badge variant={STATUS_BADGE[school.status]}>{school.status}</Badge>
        {school.sponsor_id && (
          <Badge variant="outline">livery: {school.sponsor_id}</Badge>
        )}
      </div>
      <p className="text-[13px] text-ink-3">
        Owner {school.ownerEmail ?? "invited, not signed up yet"} ·{" "}
        {count(school.admins, "admin")} ·{" "}
        {count(school.branches, "branch", "branches")} ·{" "}
        {count(school.students, "student")} this month
      </p>
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex gap-2">
          <Select
            value={next}
            onValueChange={(v) => setNext(v as SchoolStatus)}
            disabled={status.busy}
          >
            <SelectTrigger size="sm" className="w-36" aria-label="Status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
          <Button
            type="button"
            size="sm"
            variant="paper"
            disabled={status.busy || next === school.status}
            isLoading={status.busy}
            onClick={() =>
              status.submit({
                intent: "set-status",
                schoolId: school.id,
                status: next,
              })
            }
          >
            Save
          </Button>
        </div>
        <ServerFormProvider methods={owner.methods}>
          <owner.fetcher.Form
            ref={owner.formRef}
            method="post"
            onSubmit={owner.methods.handleSubmit}
            noValidate
            className="flex items-start gap-2"
          >
            <HoneypotInputs />
            <InputField
              name="email"
              label="New owner's email"
              className="w-56"
              disabled={owner.busy}
              inputProps={{ type: "email", inputMode: "email" }}
            />
            <Button
              type="submit"
              size="sm"
              variant="ghost"
              className="mt-6"
              isLoading={owner.busy}
            >
              Change owner
            </Button>
          </owner.fetcher.Form>
        </ServerFormProvider>
      </div>
    </li>
  );
}

export function StaffPanel({
  staff,
  me,
}: {
  staff: StaffMember[];
  me: string;
}) {
  const grant = useServerForm({
    schema: GrantRoleSchema,
    key: "grant-role",
    resetOnSuccess: true,
    defaultValues: { intent: "grant-role", email: "", role: "driverush_admin" },
  });
  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-display text-[20px] font-bold">Staff</h2>
      <ServerFormProvider methods={grant.methods}>
        <grant.fetcher.Form
          ref={grant.formRef}
          method="post"
          onSubmit={grant.methods.handleSubmit}
          noValidate
          className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4 sm:flex-row sm:items-start"
        >
          <HoneypotInputs />
          <InputField
            name="email"
            label="Email"
            className="flex-1"
            disabled={grant.busy}
            inputProps={{ type: "email", inputMode: "email" }}
          />
          <SelectField
            name="role"
            label="Role"
            triggerClassName="w-48"
            disabled={grant.busy}
            options={[
              { label: "Admin", value: "driverush_admin" },
              { label: "Su", value: "driverush_su" },
            ]}
          />
          <Button
            type="submit"
            variant="rush"
            className="sm:mt-6"
            isLoading={grant.busy}
          >
            Grant
          </Button>
        </grant.fetcher.Form>
      </ServerFormProvider>
      <ul className="flex flex-col divide-y divide-line rounded-lg border border-line bg-surface">
        {staff.map((s) => (
          <StaffRow
            key={`${s.userId}-${s.role}`}
            member={s}
            isMe={s.userId === me}
          />
        ))}
      </ul>
    </section>
  );
}

function StaffRow({ member, isMe }: { member: StaffMember; isMe: boolean }) {
  const { busy, submit } = useInlineAction(
    `staff:${member.userId}:${member.role}`,
  );
  return (
    <li className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="flex items-center gap-2">
        <span className="font-semibold">{member.email}</span>
        <Badge variant={member.role === "driverush_su" ? "ink" : "outline"}>
          {member.role === "driverush_su" ? "su" : "admin"}
        </Badge>
      </div>
      {!(isMe && member.role === "driverush_su") && member.email && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          isLoading={busy}
          onClick={() =>
            submit({
              intent: "revoke-role",
              email: member.email!,
              role: member.role,
            })
          }
        >
          Revoke
        </Button>
      )}
    </li>
  );
}
