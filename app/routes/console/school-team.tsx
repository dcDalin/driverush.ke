/**
 * `/console/schools/:schoolId/team`: the owner, the admins and the invites
 * not yet taken up, searched and filtered by branch and role, a page at a
 * time. Staff help a school set up its team: "Add admin", and each admin's
 * "Branches" and "Remove" and each invite's "Withdraw", open the owner's
 * own modals over this list. While the school is being set up, nobody is
 * emailed: invites go out when it is handed over.
 */
import { Link, Outlet } from "react-router";

import { Icon } from "~/components/brand/icon";
import { PlusIcon } from "~/components/brand/icons";
import { Section } from "~/components/console/shell";
import { FilterBar } from "~/components/list/filter-bar";
import { FilterSelect } from "~/components/list/filter-select";
import { PaginationBar } from "~/components/list/pagination-bar";
import { SearchInput } from "~/components/list/search-input";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
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
import { useSchoolPath } from "~/lib/school/use-school";

const ROLES = [
  { value: "all", label: "Everyone" },
  { value: "owner", label: "Owner" },
  { value: "admin", label: "Admins" },
  { value: "invited", label: "Invited, not signed up" },
] as const;

type Person = {
  key: string;
  name: string | null;
  email: string;
  kind: "owner" | "admin" | "invited";
  branchIds: string[];
  expired: boolean;
};

export default function SchoolTeam() {
  const { school, branches, team, invites, params } = useSchoolLists();
  const path = useSchoolPath();
  const inSetup = school.status === "setup";
  const people: Person[] = [
    ...team.map((m) => ({
      key: m.member_id,
      name: m.full_name,
      email: m.email ?? "",
      kind: m.role === "owner" ? ("owner" as const) : ("admin" as const),
      branchIds: m.branch_ids,
      expired: false,
    })),
    ...invites.map((i) => ({
      key: i.id,
      name: null,
      email: i.email,
      kind: "invited" as const,
      branchIds: i.branch_ids,
      expired: i.expired,
    })),
  ];
  const q = (params.get("iq") ?? "").trim().toLowerCase();
  const branch = params.get("ibranch") ?? "all";
  const role = params.get("irole") ?? "all";
  const matches = people.filter(
    (p) =>
      (role === "all" || p.kind === role) &&
      (branch === "all" ||
        p.kind === "owner" ||
        p.branchIds.includes(branch)) &&
      (!q ||
        p.email.toLowerCase().includes(q) ||
        (p.name ?? "").toLowerCase().includes(q)),
  );
  const { page, shown } = usePaged(matches);
  const names = (ids: string[]) =>
    ids
      .map((id) => branches.find((b) => b.id === id)?.name)
      .filter(Boolean)
      .join(", ");

  return (
    <Section
      title="Team"
      description={
        inSetup
          ? "Add the school's admins for it. Nobody is emailed until you hand the school over."
          : "Add and change the school's admins for it; its owner can too."
      }
      actions={
        branches.length > 0 ? (
          <Button asChild variant="rush" size="sm">
            <Link to={path("team/add")} preventScrollReset>
              <Icon icon={PlusIcon} size={16} />
              Add admin
            </Link>
          </Button>
        ) : null
      }
    >
      {branches.length === 0 ? (
        <p className="m-0 text-[13px] text-ink-3">
          Add a branch first: every admin works in one or more branches.
        </p>
      ) : null}
      <FilterBar
        params={["iq", "ibranch", "irole"]}
        pageKey="ipage"
        search={
          <SearchInput
            param="iq"
            pageKey="ipage"
            delay={150}
            placeholder="Search the team by name or email"
          />
        }
        summary={`${matches.length} ${matches.length === 1 ? "person" : "people"}`}
      >
        {branches.length > 1 ? (
          <FilterSelect
            param="ibranch"
            pageKey="ipage"
            label="Branch"
            options={[
              { value: "all", label: "Every branch" },
              ...branches.map((b) => ({ value: b.id, label: b.name })),
            ]}
          />
        ) : null}
        <FilterSelect
          param="irole"
          pageKey="ipage"
          label="Role"
          options={ROLES}
        />
      </FilterBar>
      {matches.length === 0 ? (
        <p className="m-0 rounded-lg border border-dashed border-line px-4 py-6 text-center text-[14px] text-ink-3">
          {people.length === 0
            ? "Nobody yet: it has not been handed over."
            : "Nobody matches."}
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Person</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Branches</TableHead>
              <TableHead className="w-0">
                <span className="sr-only">Change</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.map((p) => (
              <TableRow key={p.key}>
                <TableCell className="max-w-64 min-w-44">
                  <span className="block truncate font-semibold">
                    {p.name ?? p.email}
                  </span>
                  {p.name ? (
                    <span className="block truncate text-[12.5px] text-ink-3">
                      {p.email}
                    </span>
                  ) : null}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {p.kind === "owner" ? (
                    <Badge variant="ink">owner</Badge>
                  ) : p.kind === "admin" ? (
                    <Badge variant="outline">admin</Badge>
                  ) : p.expired ? (
                    <Badge variant="outline">invite expired</Badge>
                  ) : (
                    <Badge variant="amber">invited</Badge>
                  )}
                </TableCell>
                <TableCell className="min-w-40 text-ink-2">
                  {p.kind === "owner"
                    ? "Every branch"
                    : names(p.branchIds) || "None"}
                </TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  {p.kind === "admin" ? (
                    <>
                      <Button asChild size="sm" variant="ghost">
                        <Link
                          to={path(`team/${p.key}/branches`)}
                          preventScrollReset
                        >
                          Branches
                        </Link>
                      </Button>
                      <Button asChild size="sm" variant="ghost">
                        <Link
                          to={path(`team/${p.key}/remove`)}
                          preventScrollReset
                        >
                          Remove
                        </Link>
                      </Button>
                    </>
                  ) : p.kind === "invited" ? (
                    <Button asChild size="sm" variant="ghost">
                      <Link
                        to={path(`team/invites/${p.key}/withdraw`)}
                        preventScrollReset
                      >
                        Withdraw
                      </Link>
                    </Button>
                  ) : null}
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
        noun={["person", "people"]}
      />
      <Outlet />
    </Section>
  );
}
