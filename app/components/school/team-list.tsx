/**
 * A school's team as one list: the owner, the admins (each tied to one or
 * more branches) and the invites not yet taken up, searched and filtered by
 * branch and role, a page at a time. The owner's Team page and the
 * console's Team tab both show it; each admin's "Change branches" and
 * "Remove" and each invite's "Withdraw" open modal routes over the list.
 * Built for a big school: at most 50 admins, many branches.
 */
import { Link } from "react-router";

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
import { useInlineAction } from "~/lib/forms/use-inline-action";
import { adminCount, MAX_ADMINS } from "~/lib/school/admins";
import { MAX_SENDS } from "~/lib/school/student-filters";
import { useSchoolPath } from "~/lib/school/use-school";

const ROLES = [
  { value: "all", label: "Everyone" },
  { value: "owner", label: "Owner" },
  { value: "admin", label: "Admins" },
  { value: "invited", label: "Invited" },
] as const;

type Person = {
  key: string;
  name: string | null;
  email: string;
  kind: "owner" | "admin" | "invited";
  branchIds: string[];
  expired: boolean;
  sentCount: number;
};

export function TeamList({
  emailAgain = false,
  empty,
}: {
  /** Shows "Email again" on invites (the owner; staff hold emails in set-up). */
  emailAgain?: boolean;
  /** What an empty team says. */
  empty: string;
}) {
  const { branches, team, invites, params } = useSchoolLists();
  const path = useSchoolPath();
  const people: Person[] = [
    ...team.map((m) => ({
      key: m.member_id,
      name: m.full_name,
      email: m.email ?? "",
      kind: m.role === "owner" ? ("owner" as const) : ("admin" as const),
      branchIds: m.branch_ids,
      expired: false,
      sentCount: 0,
    })),
    ...invites.map((i) => ({
      key: i.id,
      name: null,
      email: i.email,
      kind: "invited" as const,
      branchIds: i.branch_ids,
      expired: i.expired,
      sentCount: i.sent_count,
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
  const admins = adminCount(team, invites);

  return (
    <>
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
        summary={`${matches.length} ${matches.length === 1 ? "person" : "people"} · ${admins} of ${MAX_ADMINS} admins`}
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
          {people.length === 0 ? empty : "Nobody matches."}
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Person</TableHead>
              <TableHead className="hidden sm:table-cell">Role</TableHead>
              <TableHead className="hidden sm:table-cell">Branches</TableHead>
              <TableHead className="w-0">
                <span className="sr-only">Change</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.map((p) => (
              <TableRow key={p.key}>
                <TableCell className="max-w-64 sm:min-w-44">
                  <span className="block truncate font-semibold">
                    {p.name ?? p.email}
                  </span>
                  {p.name ? (
                    <span className="block truncate text-[12.5px] text-ink-3">
                      {p.email}
                    </span>
                  ) : null}
                  {/* On a phone the role and branches sit here. */}
                  <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[12.5px] text-ink-2 sm:hidden">
                    <RoleBadge person={p} />
                    <span className="min-w-0 truncate">
                      {p.kind === "owner"
                        ? "Every branch"
                        : names(p.branchIds) || "No branch"}
                    </span>
                  </span>
                </TableCell>
                <TableCell className="hidden whitespace-nowrap sm:table-cell">
                  <RoleBadge person={p} />
                </TableCell>
                <TableCell className="hidden min-w-40 text-ink-2 sm:table-cell">
                  {p.kind === "owner"
                    ? "Every branch"
                    : names(p.branchIds) || "None"}
                </TableCell>
                <TableCell className="text-right align-top whitespace-nowrap sm:align-middle">
                  {p.kind === "admin" ? (
                    <span className="flex flex-col items-end gap-1 sm:flex-row sm:justify-end">
                      <Button asChild size="sm" variant="ghost">
                        <Link
                          to={path(`team/${p.key}/branches`)}
                          preventScrollReset
                        >
                          Change branches
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
                    </span>
                  ) : p.kind === "invited" ? (
                    <span className="flex flex-col items-end gap-1 sm:flex-row sm:justify-end">
                      {emailAgain ? <EmailAgain person={p} /> : null}
                      <Button asChild size="sm" variant="ghost">
                        <Link
                          to={path(`team/invites/${p.key}/withdraw`)}
                          preventScrollReset
                        >
                          Withdraw
                        </Link>
                      </Button>
                    </span>
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
    </>
  );
}

function RoleBadge({ person }: { person: Person }) {
  if (person.kind === "owner") return <Badge variant="ink">owner</Badge>;
  if (person.kind === "admin") return <Badge variant="outline">admin</Badge>;
  return person.expired ? (
    <Badge variant="outline">invite expired</Badge>
  ) : (
    <Badge variant="amber">invited</Badge>
  );
}

function EmailAgain({ person }: { person: Person }) {
  const { busy, pending, submit } = useInlineAction(`invite:${person.key}`);
  const spent = person.sentCount >= MAX_SENDS;
  return (
    <Button
      type="button"
      size="sm"
      variant={person.expired ? "rush" : "ghost"}
      disabled={busy || spent}
      isLoading={pending === "resend-invite"}
      title={
        spent
          ? `Sent ${MAX_SENDS} times: withdraw it, then add them again`
          : `Sent ${person.sentCount} of ${MAX_SENDS} times`
      }
      onClick={() => submit({ intent: "resend-invite", inviteId: person.key })}
    >
      {person.expired ? "Send again" : "Email again"}
    </Button>
  );
}
