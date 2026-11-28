/**
 * The console's smaller panels: a school's sponsorship periods and the
 * staff list (su only; "Add staff" is the `staff/grant` modal route). Server forms use `useServerForm`, one-tap changes
 * `useInlineAction`.
 */
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import type {
  ConsoleSponsorship,
  StaffMember,
} from "~/database/console/queries";
import { useInlineAction } from "~/lib/forms/use-inline-action";

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

export function Sponsorships({
  schoolId,
  sponsorships,
}: {
  schoolId: string;
  sponsorships: ConsoleSponsorship[];
}) {
  const current = currentSponsorship(sponsorships);
  const end = useInlineAction(`sponsorship:${current?.id ?? schoolId}`);
  const others = sponsorships.filter((p) => p.id !== current?.id);
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            {current ? "Sponsoring now" : "Not sponsoring"}
            {current ? <Badge variant="blue">on the board</Badge> : null}
          </CardTitle>
          <CardDescription>
            While a sponsorship runs and the school has a live livery, its cars
            take turns on the board for guests and free learners.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3 text-[14px]">
          {current ? (
            <>
              <span>
                Since {current.starts_on}
                {current.ends_on
                  ? `, until ${current.ends_on}`
                  : ", no end set"}
                {current.note ? ` (${current.note})` : ""}
              </span>
              <Button
                type="button"
                size="sm"
                variant="paper"
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
            </>
          ) : (
            <span className="text-ink-3">
              Only its own learners see its cars.
            </span>
          )}
        </CardContent>
      </Card>
      {others.length > 0 ? (
        <ul className="m-0 flex list-none flex-col divide-y divide-line rounded-lg border border-line bg-surface p-0 text-[14px]">
          {others.map((p) => (
            <li key={p.id} className="flex flex-wrap gap-x-3 px-4 py-2.5">
              <span className="font-semibold">
                {p.starts_on} to {p.ends_on ?? "no end set"}
              </span>
              {p.note ? <span className="text-ink-3">{p.note}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** Today in Kenya, `YYYY-MM-DD`: a new sponsorship's first day. */
export { kenyaToday };

export function StaffList({ staff, me }: { staff: StaffMember[]; me: string }) {
  return (
    <ul className="m-0 flex list-none flex-col divide-y divide-line rounded-lg border border-line bg-surface p-0">
      {staff.map((s) => (
        <StaffRow
          key={`${s.userId}-${s.role}`}
          member={s}
          isMe={s.userId === me}
        />
      ))}
    </ul>
  );
}

function StaffRow({ member, isMe }: { member: StaffMember; isMe: boolean }) {
  const { busy, submit } = useInlineAction(
    `staff:${member.userId}:${member.role}`,
  );
  return (
    <li className="flex items-center justify-between gap-3 px-4 py-3">
      {/* A long email wraps; "Revoke" keeps its place on a phone. */}
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        <span className="min-w-0 font-semibold break-all">{member.email}</span>
        <Badge variant={member.role === "driverush_su" ? "ink" : "outline"}>
          {member.role === "driverush_su" ? "su" : "admin"}
        </Badge>
      </div>
      {!(isMe && member.role === "driverush_su") && member.email && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="shrink-0"
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
