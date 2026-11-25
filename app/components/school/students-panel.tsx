/**
 * A school's students: add one by email to a branch, and see everyone added,
 * by branch. A student's progress shows while their month runs.
 */
import * as React from "react";

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
import type { ProgressSummary } from "~/lib/school/progress-summary";

import { useActionForm } from "./action-form";

export type StudentRow = {
  id: string;
  email: string;
  name: string | null;
  branchId: string;
  status: "pending" | "active" | "ended";
  endsAt: string | null;
  summary: ProgressSummary | null;
};

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
  const { Form, busy, ok } = useActionForm();
  const formRef = React.useRef<HTMLFormElement>(null);
  React.useEffect(() => {
    if (ok) formRef.current?.reset();
  }, [ok]);
  return (
    <Form
      ref={formRef}
      method="post"
      className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4 sm:flex-row sm:items-end"
    >
      <input type="hidden" name="intent" value="add-student" />
      <div className="flex flex-1 flex-col gap-1.5">
        <Label htmlFor="student-email">Student's email</Label>
        <Input
          id="student-email"
          name="email"
          type="email"
          required
          placeholder="name@gmail.com"
          disabled={busy}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>Branch</Label>
        <Select name="branchId" defaultValue={branches[0]?.id} disabled={busy}>
          <SelectTrigger className="w-48" aria-label="Branch">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {branches.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" variant="rush" disabled={busy}>
        Add student
      </Button>
    </Form>
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
  const { Form, busy } = useActionForm();
  const s = student.summary;
  return (
    <li className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
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
          <Form method="post" className="flex gap-2">
            <input type="hidden" name="intent" value="move-student" />
            <input type="hidden" name="linkId" value={student.id} />
            <Select
              name="branchId"
              defaultValue={moveTo[0]!.id}
              disabled={busy}
            >
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
            <Button type="submit" size="sm" variant="paper" disabled={busy}>
              Move
            </Button>
          </Form>
        )}
        {student.status === "active" && (
          <Form method="post">
            <input type="hidden" name="intent" value="release-student" />
            <input type="hidden" name="linkId" value={student.id} />
            <Button type="submit" size="sm" variant="ghost" disabled={busy}>
              Release
            </Button>
          </Form>
        )}
        {student.status === "pending" && (
          <Form method="post">
            <input type="hidden" name="intent" value="cancel-student" />
            <input type="hidden" name="linkId" value={student.id} />
            <Button type="submit" size="sm" variant="ghost" disabled={busy}>
              Withdraw
            </Button>
          </Form>
        )}
      </div>
    </li>
  );
}
