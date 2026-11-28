/**
 * A school's students ("Add student" is the `students/add` modal route):
 * find anyone added: search by name or email, filter by branch and by where
 * they are (with you this month, has a pass, no pass, waiting to join), a
 * page at a time. Everything is in the address (`?sq=&sbranch=&sstatus=
 * &spage=`), so a reload or a shared link keeps the view. A
 * student's progress and pass show while their month runs.
 */
import * as React from "react";

import { FilterBar } from "~/components/list/filter-bar";
import { FilterSelect } from "~/components/list/filter-select";
import { PaginationBar } from "~/components/list/pagination-bar";
import { SearchInput } from "~/components/list/search-input";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import type { StudentRow } from "~/database/schools/dashboard";
import { useInlineAction } from "~/lib/forms/use-inline-action";
import {
  ALL,
  filterStudents,
  MAX_SENDS,
  STUDENT_STATUSES as STATUSES,
  STUDENTS_PAGE_SIZE,
} from "~/lib/school/student-filters";
import { pageFrom, useListParams } from "~/lib/ui/use-list-params";

type Branch = { id: string; name: string; is_active: boolean };

const DATE = new Intl.DateTimeFormat("en-KE", {
  day: "numeric",
  month: "short",
  year: "numeric",
});
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
  const { searchParams } = useListParams("spage");
  const filters = {
    q: searchParams.get("sq") ?? "",
    branch: searchParams.get("sbranch") ?? ALL,
    status: searchParams.get("sstatus") ?? ALL,
  };
  const name = (id: string) => branches.find((b) => b.id === id)?.name ?? "";
  const matches = filterStudents(students, filters);
  const pages = Math.max(1, Math.ceil(matches.length / STUDENTS_PAGE_SIZE));
  const page = Math.min(pages, pageFrom(searchParams, "spage"));
  const shown = matches.slice(
    (page - 1) * STUDENTS_PAGE_SIZE,
    page * STUDENTS_PAGE_SIZE,
  );

  return (
    <section className="flex flex-col gap-4">
      <h2 className="sr-only">Students</h2>
      {students.length > 0 ? (
        <FilterBar
          params={["sq", "sbranch", "sstatus"]}
          pageKey="spage"
          search={
            <SearchInput
              param="sq"
              pageKey="spage"
              placeholder="Search by name or email"
              delay={200}
            />
          }
          summary={`${matches.length} ${matches.length === 1 ? "student" : "students"}`}
        >
          {mine.length > 1 ? (
            <FilterSelect
              param="sbranch"
              pageKey="spage"
              label="Branch"
              options={[
                { value: ALL, label: "All my branches" },
                ...mine.map((b) => ({ value: b.id, label: b.name })),
              ]}
            />
          ) : null}
          <FilterSelect
            param="sstatus"
            pageKey="spage"
            label="Which students"
            options={STATUSES}
          />
        </FilterBar>
      ) : null}

      {students.length === 0 ? (
        <p className="m-0 rounded-lg border border-dashed border-line px-4 py-8 text-center text-[14px] text-ink-3">
          No students yet. Add this week's class by email: each one gets an
          email with a link.
        </p>
      ) : shown.length === 0 ? (
        <p className="m-0 rounded-lg border border-dashed border-line px-4 py-8 text-center text-[14px] text-ink-3">
          No student matches. Clear the filters to see everyone.
        </p>
      ) : (
        <>
          <ul className="m-0 flex list-none flex-col divide-y divide-line rounded-lg border border-line bg-surface p-0">
            {shown.map((s) => (
              <StudentItem
                key={s.id}
                student={s}
                branchName={name(s.branchId)}
                moveTo={open.filter((b) => b.id !== s.branchId)}
              />
            ))}
          </ul>
          <PaginationBar
            page={page}
            pageSize={STUDENTS_PAGE_SIZE}
            totalCount={matches.length}
            pageKey="spage"
            noun={["student", "students"]}
          />
        </>
      )}
    </section>
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
              With you until {DATE.format(new Date(student.endsAt))}
            </Badge>
          )}
          {student.status === "pending" && student.inviteExpired ? (
            <Badge variant="outline">Invite expired</Badge>
          ) : student.status === "pending" ? (
            <Badge variant="amber">Waiting for them</Badge>
          ) : null}
          {student.status === "pending" ? (
            <span className="text-ink-3">
              Sent {student.sentCount} of {MAX_SENDS} times, last{" "}
              {DATE.format(new Date(student.lastSentAt))}
            </span>
          ) : null}
          {student.status === "ended" && (
            <Badge variant="outline">Month over</Badge>
          )}
          {student.passEndsAt ? (
            <Badge variant={student.passThroughSchool ? "green" : "blue"}>
              {student.passThroughSchool ? "Paid through you" : "Own pass"}{" "}
              until {DATE.format(new Date(student.passEndsAt))}
            </Badge>
          ) : student.status === "active" ? (
            <Badge variant="outline">No pass yet</Badge>
          ) : null}
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
            variant={student.inviteExpired ? "rush" : "paper"}
            disabled={busy || student.sentCount >= MAX_SENDS}
            isLoading={pending === "resend-student"}
            title={
              student.sentCount >= MAX_SENDS
                ? "Sent 5 times: withdraw it, then add them again"
                : undefined
            }
            onClick={() =>
              submit({ intent: "resend-student", linkId: student.id })
            }
          >
            {student.inviteExpired ? "Send again" : "Email again"}
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
