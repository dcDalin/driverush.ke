/**
 * A school's students: add one by email to a branch, and see everyone added,
 * by branch. A student's progress shows while their month runs.
 */
import * as React from "react";
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
import type { StudentRow } from "~/database/schools/dashboard";
import { useInlineAction } from "~/lib/forms/use-inline-action";
import { useServerForm } from "~/lib/forms/use-server-form";
import { AddStudentSchema } from "~/schemas/school";

type Branch = { id: string; name: string; is_active: boolean };

const DATE = new Intl.DateTimeFormat("en-KE", {
  day: "numeric",
  month: "short",
  year: "numeric",
});
const ALL = "all";

export function StudentsPanel({
  students,
  branches,
  myBranchIds,
}: {
  students: StudentRow[];
  branches: Branch[];
  myBranchIds: string[];
}) {
  const mine = branches.filter((b) => myBranchIds.includes(b.id));
  const open = mine.filter((b) => b.is_active);
  const [filter, setFilter] = React.useState(ALL);
  const name = (id: string) => branches.find((b) => b.id === id)?.name ?? "";
  const shown = students.filter((s) => filter === ALL || s.branchId === filter);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="font-display text-[20px] font-bold">Students</h2>
        {mine.length > 1 && (
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-48" aria-label="Branch">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All my branches</SelectItem>
              {mine.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {open.length > 0 ? (
        <AddStudent branches={open} />
      ) : (
        <p className="text-[14px] text-ink-3">
          Add a branch first, then add students to it.
        </p>
      )}

      {shown.length === 0 ? (
        <p className="text-[14px] text-ink-3">No students yet.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line rounded-lg border border-line bg-surface">
          {shown.map((s) => (
            <StudentItem
              key={s.id}
              student={s}
              branchName={name(s.branchId)}
              moveTo={open.filter((b) => b.id !== s.branchId)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function AddStudent({ branches }: { branches: Branch[] }) {
  const { methods, fetcher, formRef, busy } = useServerForm({
    schema: AddStudentSchema,
    key: "add-student",
    resetOnSuccess: true,
    defaultValues: {
      intent: "add-student",
      email: "",
      branchId: branches[0]?.id ?? "",
    },
  });
  return (
    <ServerFormProvider methods={methods}>
      <fetcher.Form
        ref={formRef}
        method="post"
        onSubmit={methods.handleSubmit}
        noValidate
        className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4 sm:flex-row sm:items-start"
      >
        <HoneypotInputs />
        <InputField
          name="email"
          label="Student's email"
          className="flex-1"
          disabled={busy}
          inputProps={{
            type: "email",
            inputMode: "email",
            placeholder: "name@gmail.com",
          }}
        />
        <SelectField
          name="branchId"
          label="Branch"
          disabled={busy}
          triggerClassName="w-48"
          options={branches.map((b) => ({ label: b.name, value: b.id }))}
        />
        <Button
          type="submit"
          variant="rush"
          isLoading={busy}
          className="sm:mt-6"
        >
          Add student
        </Button>
      </fetcher.Form>
    </ServerFormProvider>
  );
}

function StudentItem({
  student,
  branchName,
  moveTo,
}: {
  student: StudentRow;
  branchName: string;
  moveTo: Branch[];
}) {
  const { pending, busy, submit } = useInlineAction(`student:${student.id}`);
  const [target, setTarget] = React.useState(moveTo[0]?.id ?? "");
  const s = student.summary;
  return (
    <li
      className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
      aria-busy={busy || undefined}
    >
      <div className="flex min-w-0 flex-col gap-1">
        <p className="truncate font-semibold">
          {student.name ?? student.email}
        </p>
        <p className="truncate text-[13px] text-ink-3">
          {student.name ? `${student.email} · ` : ""}
          {branchName}
        </p>
        <div className="flex flex-wrap items-center gap-2 text-[13px] text-ink-2">
          {student.status === "active" && student.endsAt && (
            <Badge variant="green">
              Until {DATE.format(new Date(student.endsAt))}
            </Badge>
          )}
          {student.status === "pending" && (
            <Badge variant="amber">Waiting for them</Badge>
          )}
          {student.status === "ended" && (
            <Badge variant="outline">Month over</Badge>
          )}
          {s && (
            <span>
              {s.levels} levels · {s.signsMastered} signs · {s.streakDays}-day
              streak
              {s.testDate ? ` · test ${DATE.format(new Date(s.testDate))}` : ""}
              {s.testResult === "passed"
                ? " (passed)"
                : s.testResult === "failed"
                  ? " (not passed)"
                  : ""}
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {moveTo.length > 0 && student.status !== "ended" && (
          <div className="flex gap-2">
            <Select value={target} onValueChange={setTarget} disabled={busy}>
              <SelectTrigger
                size="sm"
                className="w-36"
                aria-label="Move to branch"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {moveTo.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              size="sm"
              variant="paper"
              disabled={busy || !target}
              isLoading={pending === "move-student"}
              onClick={() =>
                submit({
                  intent: "move-student",
                  linkId: student.id,
                  branchId: target,
                })
              }
            >
              Move
            </Button>
          </div>
        )}
        {student.status === "active" && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={busy}
            isLoading={pending === "release-student"}
            onClick={() =>
              submit({ intent: "release-student", linkId: student.id })
            }
          >
            Release
          </Button>
        )}
        {student.status === "pending" && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={busy}
            isLoading={pending === "cancel-student"}
            onClick={() =>
              submit({ intent: "cancel-student", linkId: student.id })
            }
          >
            Withdraw
          </Button>
        )}
      </div>
    </li>
  );
}
