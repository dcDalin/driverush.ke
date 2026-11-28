/**
 * `/console/schools/:schoolId/inside`: a read-only look inside a school, for
 * DriveRush staff on a support call (owner, 2026-11-28: staff look from the
 * console, never from the school's own dashboard). Its branches, its team
 * and its students with their progress. Nothing here can be changed.
 */
import * as React from "react";
import { data } from "react-router";

import { Section } from "~/components/console/shell";
import { Badge } from "~/components/ui/badge";
import { Input } from "~/components/ui/input";
import { getSchoolDashboard } from "~/database/schools/dashboard";
import { getRequestClient } from "~/lib/auth/require.server";
import { consoleGate, GATED } from "~/lib/console/gate.server";

import type { Route } from "./+types/school-inside";

export async function loader({ request, params }: Route.LoaderArgs) {
  const context = await getRequestClient(request);
  const gate = await consoleGate(context);
  const { headers } = context;
  if (!gate.ok) return data(GATED, { headers });
  const { supabase, caller } = gate.staff;
  const inside = await getSchoolDashboard(supabase, {
    schoolId: params.schoolId,
    userId: caller.userId,
    role: caller.role,
  });
  if (!inside) return data(GATED, { headers });
  const { branches, team, invites, students } = inside;
  return data(
    { gated: false as const, branches, team, invites, students },
    {
      headers,
    },
  );
}

const DATE = new Intl.DateTimeFormat("en-KE", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const list =
  "m-0 flex list-none flex-col divide-y divide-line rounded-lg border border-line bg-surface p-0";
const row =
  "flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-2.5";
const empty =
  "m-0 rounded-lg border border-dashed border-line px-4 py-5 text-[14px] text-ink-3";
const SHOWN = 50;

export default function SchoolInside({ loaderData }: Route.ComponentProps) {
  const [q, setQ] = React.useState("");
  if (loaderData.gated) return null;
  const { branches, team, invites, students } = loaderData;
  const branchName = (id: string) =>
    branches.find((b) => b.id === id)?.name ?? "";
  const names = (ids: string[]) =>
    ids.map(branchName).filter(Boolean).join(", ");
  const needle = q.trim().toLowerCase();
  const found = needle
    ? students.filter(
        (s) =>
          s.email.toLowerCase().includes(needle) ||
          (s.name ?? "").toLowerCase().includes(needle),
      )
    : students;
  return (
    <>
      <p className="m-0 rounded-lg border border-line bg-paper-2 px-4 py-3 text-[13.5px] text-ink-2">
        Read only. The school's owner and admins change these in their own
        dashboard.
      </p>

      <Section title={`Branches (${branches.length})`}>
        {branches.length === 0 ? (
          <p className={empty}>No branch yet.</p>
        ) : (
          <ul className={list}>
            {branches.map((b) => (
              <li key={b.id} className={row}>
                <span className="font-semibold">{b.name}</span>
                <span className="flex items-center gap-2 text-[13px] text-ink-3">
                  {b.town || "No town"}
                  {!b.is_active && <Badge variant="amber">Closed</Badge>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={`Team (${team.length + invites.length})`}>
        {team.length + invites.length === 0 ? (
          <p className={empty}>Nobody yet: it has not been handed over.</p>
        ) : (
          <ul className={list}>
            {team.map((m) => (
              <li key={m.member_id} className={row}>
                <span className="min-w-0">
                  <span className="font-semibold">
                    {m.full_name ?? m.email}
                  </span>
                  {m.full_name ? (
                    <span className="text-[13px] text-ink-3"> · {m.email}</span>
                  ) : null}
                </span>
                <span className="flex items-center gap-2 text-[13px] text-ink-3">
                  {m.role === "owner" ? "every branch" : names(m.branch_ids)}
                  <Badge variant={m.role === "owner" ? "ink" : "outline"}>
                    {m.role}
                  </Badge>
                </span>
              </li>
            ))}
            {invites.map((i) => (
              <li key={i.id} className={row}>
                <span className="font-semibold">{i.email}</span>
                <span className="flex items-center gap-2 text-[13px] text-ink-3">
                  Invited {i.role}, not signed up yet
                  {i.expired ? (
                    <Badge variant="outline">Invite expired</Badge>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={`Students (${students.length})`}>
        {students.length === 0 ? (
          <p className={empty}>No students yet.</p>
        ) : (
          <>
            <Input
              type="search"
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder="Search by name or email"
              aria-label="Search this school's students"
            />
            {found.length === 0 ? (
              <p className={empty}>No student matches.</p>
            ) : (
              <ul className={list}>
                {found.slice(0, SHOWN).map((s) => (
                  <li key={s.id} className={row}>
                    <span className="min-w-0">
                      <span className="block font-semibold">
                        {s.name ?? s.email}
                      </span>
                      <span className="block text-[13px] text-ink-3">
                        {s.name ? `${s.email} · ` : ""}
                        {branchName(s.branchId)}
                        {s.summary
                          ? ` · ${s.summary.levels} levels · ${s.summary.signsMastered} signs`
                          : ""}
                      </span>
                    </span>
                    <span className="flex flex-wrap items-center gap-2">
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
                      {s.passEndsAt ? (
                        <Badge variant="blue">Has a pass</Badge>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {found.length > SHOWN ? (
              <p className="m-0 text-[13px] text-ink-3">
                Showing the first {SHOWN} of {found.length}. Search to narrow
                it.
              </p>
            ) : null}
          </>
        )}
      </Section>
    </>
  );
}
