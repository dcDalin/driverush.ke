/**
 * The console's forms and rows (`/console`). Each form posts one action to
 * the console route without leaving the page (`useActionForm`).
 */
import { Link } from "react-router";

import { useActionForm } from "~/components/school/action-form";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

type SchoolStatus = "active" | "suspended" | "archived";

export type ConsoleSchool = {
  id: string;
  name: string;
  slug: string;
  status: SchoolStatus;
  sponsor_id: string | null;
  ownerEmail: string | null;
  admins: number;
  branches: number;
  students: number;
};

export function CreateSchool({
  sponsors,
}: {
  sponsors: { id: string; school: string }[];
}) {
  const { Form, busy } = useActionForm();
  return (
    <Form
      method="post"
      className="grid gap-3 rounded-lg border border-line bg-surface p-4 sm:grid-cols-2"
    >
      <input type="hidden" name="intent" value="create-school" />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="school-name">School name</Label>
        <Input
          id="school-name"
          name="name"
          required
          minLength={2}
          placeholder="Heltz Driving School"
          disabled={busy}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="school-slug">Short name (for links)</Label>
        <Input
          id="school-slug"
          name="slug"
          required
          pattern="[a-z0-9]+(-[a-z0-9]+)*"
          placeholder="heltz"
          disabled={busy}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="school-owner">Owner's email</Label>
        <Input
          id="school-owner"
          name="ownerEmail"
          type="email"
          required
          placeholder="owner@school.co.ke"
          disabled={busy}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>Livery</Label>
        <Select name="sponsorId" defaultValue="none" disabled={busy}>
          <SelectTrigger aria-label="Livery">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None yet (plain cars)</SelectItem>
            {sponsors.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.school}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button
        type="submit"
        variant="rush"
        className="self-start sm:col-span-2"
        disabled={busy}
      >
        Create school
      </Button>
    </Form>
  );
}

/** "1 branch", "2 branches". */
function count(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

const STATUS_BADGE = {
  active: "green",
  suspended: "amber",
  archived: "outline",
} as const;

export function SchoolRow({ school }: { school: ConsoleSchool }) {
  const status = useActionForm();
  const owner = useActionForm();
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
      <div className="flex flex-wrap items-end gap-3">
        <status.Form method="post" className="flex gap-2">
          <input type="hidden" name="intent" value="set-status" />
          <input type="hidden" name="schoolId" value={school.id} />
          <Select
            name="status"
            defaultValue={school.status}
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
            type="submit"
            size="sm"
            variant="paper"
            disabled={status.busy}
          >
            Save
          </Button>
        </status.Form>
        <owner.Form method="post" className="flex gap-2">
          <input type="hidden" name="intent" value="transfer-owner" />
          <input type="hidden" name="schoolId" value={school.id} />
          <Input
            name="email"
            type="email"
            required
            placeholder="New owner's email"
            aria-label="New owner's email"
            className="h-9 w-56"
            disabled={owner.busy}
          />
          <Button type="submit" size="sm" variant="ghost" disabled={owner.busy}>
            Change owner
          </Button>
        </owner.Form>
      </div>
    </li>
  );
}

export function StaffPanel({
  staff,
  me,
}: {
  staff: { userId: string; role: string; email: string | null }[];
  me: string;
}) {
  const grant = useActionForm();
  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-display text-[20px] font-bold">Staff</h2>
      <grant.Form
        method="post"
        className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4 sm:flex-row sm:items-end"
      >
        <input type="hidden" name="intent" value="grant-role" />
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="staff-email">Email</Label>
          <Input
            id="staff-email"
            name="email"
            type="email"
            required
            disabled={grant.busy}
          />
        </div>
        <Select
          name="role"
          defaultValue="driverush_admin"
          disabled={grant.busy}
        >
          <SelectTrigger className="w-48" aria-label="Role">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="driverush_admin">Admin</SelectItem>
            <SelectItem value="driverush_su">Su</SelectItem>
          </SelectContent>
        </Select>
        <Button type="submit" variant="rush" disabled={grant.busy}>
          Grant
        </Button>
      </grant.Form>
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

function StaffRow({
  member,
  isMe,
}: {
  member: { role: string; email: string | null };
  isMe: boolean;
}) {
  const { Form, busy } = useActionForm();
  return (
    <li className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="flex items-center gap-2">
        <span className="font-semibold">{member.email}</span>
        <Badge variant={member.role === "driverush_su" ? "ink" : "outline"}>
          {member.role === "driverush_su" ? "su" : "admin"}
        </Badge>
      </div>
      {!(isMe && member.role === "driverush_su") && member.email && (
        <Form method="post">
          <input type="hidden" name="intent" value="revoke-role" />
          <input type="hidden" name="email" value={member.email} />
          <input type="hidden" name="role" value={member.role} />
          <Button type="submit" size="sm" variant="ghost" disabled={busy}>
            Revoke
          </Button>
        </Form>
      )}
    </li>
  );
}
