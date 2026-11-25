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
import { Separator } from "~/components/ui/separator";
import type {
  ConsoleLivery,
  ConsoleSchool,
  ConsoleSponsorship,
  StaffMember,
} from "~/database/console/queries";
import type { SchoolStatus } from "~/database/types";
import { useInlineAction } from "~/lib/forms/use-inline-action";
import { useServerForm } from "~/lib/forms/use-server-form";
import {
  CreateSchoolSchema,
  GrantRoleSchema,
  SetSponsorshipSchema,
  TransferOwnerSchema,
} from "~/schemas/console";

export function CreateSchool() {
  const { methods, fetcher, formRef, busy } = useServerForm({
    schema: CreateSchoolSchema,
    key: "create-school",
    resetOnSuccess: true,
    defaultValues: {
      intent: "create-school",
      name: "",
      slug: "",
      ownerEmail: "",
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

export function SchoolRow({
  school,
  children,
}: {
  school: ConsoleSchool;
  /** More about the school under its liveries (its passes). */
  children?: React.ReactNode;
}) {
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
        {school.liveries.some((l) => l.status === "live") ? (
          <Badge variant="outline">livery on</Badge>
        ) : (
          <Badge variant="outline">plain cars</Badge>
        )}
        {currentSponsorship(school.sponsorships) && (
          <Badge variant="green">sponsoring</Badge>
        )}
        <Link
          to={`/school/${school.id}#profile`}
          className="ml-auto text-[13px] underline underline-offset-4"
        >
          Edit profile
        </Link>
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
      <Separator />
      <div className="grid gap-4 sm:grid-cols-2">
        <Liveries slug={school.slug} liveries={school.liveries} />
        <Sponsorships schoolId={school.id} sponsorships={school.sponsorships} />
      </div>
      {children && (
        <>
          <Separator />
          {children}
        </>
      )}
    </li>
  );
}

/** Today in Kenya, as the database writes sponsorship days. */
function kenyaToday(now = Date.now()) {
  return new Date(now + 3 * 3_600_000).toISOString().slice(0, 10);
}

function currentSponsorship(list: ConsoleSponsorship[]) {
  const today = kenyaToday();
  return (
    list.find(
      (p) => p.starts_on <= today && (p.ends_on === null || p.ends_on >= today),
    ) ?? null
  );
}

const LIVERY_BADGE = {
  live: "green",
  draft: "amber",
  retired: "outline",
} as const;

/**
 * A school's liveries: a draft (from `npm run livery:publish`) is previewed
 * on the board with `?livery=`, then published; the live one can be retired.
 */
function Liveries({
  slug,
  liveries,
}: {
  slug: string;
  liveries: ConsoleLivery[];
}) {
  const shown = liveries.filter((l) => l.status !== "retired").slice(0, 4);
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-[13px] font-semibold text-ink-2">Liveries</h3>
      {shown.length === 0 ? (
        <p className="m-0 text-[13px] text-ink-3">
          None yet. Make one with the art pipeline, then{" "}
          <code>npm run livery:publish {slug}</code>.
        </p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {shown.map((livery) => (
            <LiveryRow key={livery.id} livery={livery} />
          ))}
        </ul>
      )}
    </div>
  );
}

function LiveryRow({ livery }: { livery: ConsoleLivery }) {
  const action = useInlineAction(`livery:${livery.id}`);
  return (
    <li className="flex flex-wrap items-center gap-2">
      <Badge variant={LIVERY_BADGE[livery.status]}>{livery.status}</Badge>
      <span className="text-[13px]">{livery.label}</span>
      <span className="ml-auto flex gap-1.5">
        <Button size="sm" variant="ghost" asChild>
          <Link to={`/model-town-board/play?livery=${livery.id}`}>Preview</Link>
        </Button>
        {livery.status === "draft" ? (
          <Button
            type="button"
            size="sm"
            variant="paper"
            isLoading={action.busy}
            onClick={() =>
              action.submit({ intent: "publish-livery", liveryId: livery.id })
            }
          >
            Publish
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            isLoading={action.busy}
            onClick={() =>
              action.submit({ intent: "retire-livery", liveryId: livery.id })
            }
          >
            Retire
          </Button>
        )}
      </span>
    </li>
  );
}

/** When the school's cars take turns for guests and free learners. */
function Sponsorships({
  schoolId,
  sponsorships,
}: {
  schoolId: string;
  sponsorships: ConsoleSponsorship[];
}) {
  const current = currentSponsorship(sponsorships);
  const end = useInlineAction(`sponsorship:${current?.id ?? schoolId}`);
  const form = useServerForm({
    schema: SetSponsorshipSchema,
    key: `set-sponsorship:${schoolId}`,
    resetOnSuccess: true,
    defaultValues: {
      intent: "set-sponsorship",
      schoolId,
      startsOn: kenyaToday(),
      endsOn: "",
      note: "",
    },
  });
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-[13px] font-semibold text-ink-2">Sponsorship</h3>
      {current ? (
        <div className="flex flex-wrap items-center gap-2 text-[13px]">
          <span>
            Since {current.starts_on}
            {current.ends_on ? `, until ${current.ends_on}` : ", no end set"}
            {current.note ? ` (${current.note})` : ""}
          </span>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            isLoading={end.busy}
            onClick={() =>
              end.submit({
                intent: "end-sponsorship",
                sponsorshipId: current.id,
              })
            }
          >
            End today
          </Button>
        </div>
      ) : (
        <p className="m-0 text-[13px] text-ink-3">
          Not sponsoring: only its own learners see its cars.
        </p>
      )}
      <ServerFormProvider methods={form.methods}>
        <form.fetcher.Form
          ref={form.formRef}
          method="post"
          onSubmit={form.methods.handleSubmit}
          noValidate
          className="flex flex-wrap items-start gap-2"
        >
          <HoneypotInputs />
          <InputField
            name="startsOn"
            label="From"
            className="w-40"
            disabled={form.busy}
            inputProps={{ type: "date" }}
          />
          <InputField
            name="endsOn"
            label="Until (optional)"
            className="w-40"
            disabled={form.busy}
            inputProps={{ type: "date" }}
          />
          <Button
            type="submit"
            size="sm"
            variant="paper"
            className="mt-6"
            isLoading={form.busy}
          >
            Add
          </Button>
        </form.fetcher.Form>
      </ServerFormProvider>
    </div>
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
