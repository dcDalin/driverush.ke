/**
 * `/console/schools/:schoolId/students`: the school's students, read only
 * (owner, 2026-11-28: staff help a school set up, but its learners are its
 * own). Searched by name or email and filtered by branch and status, a page
 * at a time, as a compact table.
 */
import { Section } from "~/components/console/shell";
import { FilterBar } from "~/components/list/filter-bar";
import { FilterSelect } from "~/components/list/filter-select";
import { PaginationBar } from "~/components/list/pagination-bar";
import { SearchInput } from "~/components/list/search-input";
import { Badge } from "~/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import {
  LIST_PAGE,
  usePaged,
  useSchoolLists,
} from "~/lib/console/use-school-lists";
import {
  ALL,
  filterStudents,
  STUDENT_STATUSES,
} from "~/lib/school/student-filters";

const DATE = new Intl.DateTimeFormat("en-KE", {
  day: "numeric",
  month: "short",
});

export default function SchoolStudents() {
  const { branches, students, params } = useSchoolLists();
  const matches = filterStudents(students, {
    q: params.get("iq") ?? "",
    branch: params.get("ibranch") ?? ALL,
    status: params.get("istatus") ?? ALL,
  });
  const { page, shown } = usePaged(matches);
  const branchName = (id: string) =>
    branches.find((b) => b.id === id)?.name ?? "";

  return (
    <Section
      title="Students"
      description="Read only. Only the school's owner and admins add, move or release students."
    >
      <FilterBar
        params={["iq", "ibranch", "istatus"]}
        pageKey="ipage"
        search={
          <SearchInput
            param="iq"
            pageKey="ipage"
            delay={150}
            placeholder="Search students by name or email"
          />
        }
        summary={`${matches.length} ${matches.length === 1 ? "student" : "students"}`}
      >
        {branches.length > 1 ? (
          <FilterSelect
            param="ibranch"
            pageKey="ipage"
            label="Branch"
            options={[
              { value: ALL, label: "Every branch" },
              ...branches.map((b) => ({ value: b.id, label: b.name })),
            ]}
          />
        ) : null}
        <FilterSelect
          param="istatus"
          pageKey="ipage"
          label="Which students"
          options={STUDENT_STATUSES}
        />
      </FilterBar>
      {matches.length === 0 ? (
        <p className="m-0 rounded-lg border border-dashed border-line px-4 py-6 text-center text-[14px] text-ink-3">
          {students.length === 0 ? "No students yet." : "No student matches."}
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student</TableHead>
              <TableHead className="hidden sm:table-cell">Branch</TableHead>
              <TableHead>With the school</TableHead>
              <TableHead className="hidden text-right md:table-cell">
                Levels
              </TableHead>
              <TableHead className="hidden text-right md:table-cell">
                Signs
              </TableHead>
              <TableHead>Pass</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="max-w-64 min-w-36">
                  <span className="block truncate font-semibold">
                    {s.name ?? s.email}
                  </span>
                  {s.name ? (
                    <span className="block truncate text-[12.5px] text-ink-3">
                      {s.email}
                    </span>
                  ) : null}
                  {/* On a phone the branch sits under the name. */}
                  <span className="block truncate text-[12.5px] text-ink-3 sm:hidden">
                    {branchName(s.branchId)}
                  </span>
                </TableCell>
                <TableCell className="hidden whitespace-nowrap text-ink-2 sm:table-cell">
                  {branchName(s.branchId)}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {s.inviteExpired ? (
                    <Badge variant="outline">Invite expired</Badge>
                  ) : s.status === "pending" ? (
                    <Badge variant="amber">Waiting to join</Badge>
                  ) : s.status === "active" && s.endsAt ? (
                    <Badge variant="green">
                      Until {DATE.format(new Date(s.endsAt))}
                    </Badge>
                  ) : (
                    <Badge variant="outline">Month over</Badge>
                  )}
                </TableCell>
                <TableCell className="hidden text-right tabular-nums md:table-cell">
                  {s.summary ? s.summary.levels : "–"}
                </TableCell>
                <TableCell className="hidden text-right tabular-nums md:table-cell">
                  {s.summary ? s.summary.signsMastered : "–"}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {s.passEndsAt ? (
                    <Badge variant={s.passThroughSchool ? "green" : "blue"}>
                      {s.passThroughSchool ? "Through school" : "Own"} to{" "}
                      {DATE.format(new Date(s.passEndsAt))}
                    </Badge>
                  ) : (
                    <span className="text-ink-4">None</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <PaginationBar
        page={page}
        pageSize={LIST_PAGE}
        totalCount={matches.length}
        pageKey="ipage"
        noun={["student", "students"]}
      />
    </Section>
  );
}
