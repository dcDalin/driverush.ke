/**
 * A school's set-up, on its console page, as one guided list in the order a
 * staff member works through it on a call with the school (owner,
 * 2026-11-28: most schools are not tech savvy and need hand holding):
 *
 *   1. profile and logo   2. branches   3. admins (optional)
 *   4. livery             5. hand it to its owner
 *
 * Each step opens where it is done, here in the console. Then what is left
 * for the owner (their bank, their students), and whether the school is
 * public yet. Staff never do students or the price.
 */
import { Link } from "react-router";

import { Icon } from "~/components/brand/icon";
import {
  CheckIcon,
  ChevronRightIcon,
  MinusIcon,
} from "~/components/brand/icons";
import { Section } from "~/components/console/shell";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import type { ConsoleSchool } from "~/database/console/queries";
import { useConsoleSchoolPath } from "~/lib/console/use-console-school";
import { useSchool } from "~/lib/school/use-school";
import { cn } from "~/lib/utils";

const EXPIRED = new Intl.DateTimeFormat("en-KE", {
  timeZone: "Africa/Nairobi",
  day: "numeric",
  month: "short",
});

function Step({
  done,
  label,
  detail,
  action,
}: {
  done: boolean;
  label: string;
  detail: string;
  /** Where staff do it. The owner's steps have none. */
  action?: { label: string; to: string };
}) {
  return (
    // On a phone the action sits under the words, so they get the width.
    <li className="grid grid-cols-[1.5rem_1fr] items-start gap-x-3 gap-y-2 px-4 py-3 sm:grid-cols-[1.5rem_1fr_auto] sm:items-center">
      <span
        className={
          done
            ? "flex size-6 shrink-0 items-center justify-center rounded-full bg-kenya-green text-kenya-green-foreground"
            : "flex size-6 shrink-0 items-center justify-center rounded-full border border-line text-ink-3"
        }
      >
        <Icon icon={done ? CheckIcon : MinusIcon} size={14} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[14px] font-semibold">{label}</span>
        <span className="text-[13px] text-ink-3">{detail}</span>
      </span>
      {action ? (
        <Button
          asChild
          size="sm"
          variant={done ? "ghost" : "paper"}
          // A ghost button's words line up with the step's on a phone.
          className={cn(
            "col-start-2 justify-self-start sm:col-start-auto",
            done && "max-sm:-ml-3.5",
          )}
        >
          <Link to={action.to} preventScrollReset>
            {action.label}
            <Icon icon={ChevronRightIcon} size={14} />
          </Link>
        </Button>
      ) : null}
    </li>
  );
}

const list =
  "m-0 flex list-none flex-col divide-y divide-line rounded-lg border border-line bg-surface p-0";

export function SetupChecklist({ school }: { school: ConsoleSchool }) {
  const consoleSchoolPath = useConsoleSchoolPath();
  const inside = useSchool();
  const { setup } = school;
  const id = school.school.id;
  const to = (page: string) => consoleSchoolPath(id, page);
  const owned = Boolean(school.ownerEmail || school.invitedOwnerEmail);
  const inSetup = school.school.status === "setup";
  const live = school.school.status === "active";
  const admins =
    inside.team.filter((m) => m.role === "admin").length +
    inside.invites.filter((i) => i.role === "admin").length;
  const profileDone = setup.profile && setup.logo;
  return (
    <>
      <Section
        title={inSetup ? "Set it up, then hand it over" : "Set-up"}
        description={
          inSetup
            ? "Work through these with the school, on a call if it helps. Nobody is emailed until you hand it over."
            : "Done with the school. You can still help it change any of these."
        }
      >
        <ol className={list}>
          <Step
            done={profileDone}
            label="1. Profile and logo"
            detail={
              profileDone
                ? "Filled in."
                : setup.profile
                  ? "No logo yet."
                  : setup.logo
                    ? "No tagline or about text yet."
                    : "What learners read about the school, and its logo."
            }
            action={{
              label: profileDone ? "Open profile" : "Fill it in",
              to: to("profile"),
            }}
          />
          <Step
            done={setup.branches > 0}
            label="2. Branches"
            detail={
              setup.branches > 0
                ? `${setup.branches} ${setup.branches === 1 ? "branch" : "branches"}.`
                : "Students and admins belong to a branch."
            }
            action={
              setup.branches > 0
                ? { label: "Open branches", to: to("branches") }
                : { label: "Add a branch", to: to("branches/add") }
            }
          />
          <Step
            done={admins > 0}
            label="3. Admins (optional)"
            detail={
              admins > 0
                ? `${admins} ${admins === 1 ? "admin" : "admins"}.`
                : setup.branches > 0
                  ? "The people who add students at each branch."
                  : "After a branch."
            }
            action={
              setup.branches === 0
                ? undefined
                : admins > 0
                  ? { label: "Open team", to: to("team") }
                  : { label: "Add an admin", to: to("team/add") }
            }
          />
          <Step
            done={setup.livery === "live"}
            label="4. Livery"
            detail={
              setup.livery === "live"
                ? "Published: the school's cars are on the board."
                : setup.livery === "draft"
                  ? "A draft is waiting: preview it, then publish."
                  : "Nothing uploaded yet."
            }
            action={
              setup.livery === "none"
                ? { label: "Upload livery", to: to("livery/upload") }
                : { label: "Open livery", to: to("livery") }
            }
          />
          <Step
            done={owned}
            label="5. Owner"
            detail={
              school.ownerEmail
                ? `${school.ownerEmail} owns it.`
                : school.invitedOwnerEmail
                  ? `${school.invitedOwnerEmail} is invited: they own it once they sign up.`
                  : school.expiredOwnerInvite
                    ? `The invite to ${school.expiredOwnerInvite.email} expired on ${EXPIRED.format(new Date(school.expiredOwnerInvite.expiredAt))}: hand it over again.`
                    : "Not handed over yet. The owner gets an email saying what is done and what is left."
            }
            action={{
              label: inSetup ? "Hand over" : "Change owner",
              to: to("hand-over"),
            }}
          />
        </ol>
      </Section>

      <Section
        title={
          <span className="flex flex-wrap items-center gap-2">
            Left for the school
            {live && setup.ready ? (
              <Badge variant="green">public</Badge>
            ) : (
              <Badge variant="outline">not public yet</Badge>
            )}
          </span>
        }
        description="The school's own: staff do not do these. It goes public once it has a logo, a profile and an open branch."
      >
        <ul className={list}>
          <Step
            done={setup.payments === "live"}
            label="Its bank"
            detail={
              setup.payments === "live"
                ? "Taking payments."
                : setup.payments === "waiting"
                  ? "The owner sent a bank: it is waiting for your check."
                  : "The owner sends it from their dashboard."
            }
            action={
              setup.payments === "waiting"
                ? { label: "Check the bank", to: to("payments") }
                : undefined
            }
          />
          <Step
            done={inside.students.length > 0}
            label="Its students"
            detail={
              inside.students.length > 0
                ? `${inside.students.length} added.`
                : "The owner and admins add them by email."
            }
          />
        </ul>
      </Section>
    </>
  );
}
