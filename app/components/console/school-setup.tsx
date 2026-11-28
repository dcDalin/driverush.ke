/**
 * A school's set-up, on its console page, in two parts (owner, 2026-11-28):
 *
 *   DriveRush's part   the livery (we make the school's cars) and handing
 *                      the school to its owner. Each step links to where it
 *                      is done, here in the console.
 *   The owner's part   logo, profile, a first branch and the bank, done in
 *                      the school's own dashboard. Staff see how far the
 *                      owner has got, and whether the school is public yet;
 *                      they do not do it for them.
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
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
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
        <Button asChild size="sm" variant={done ? "ghost" : "paper"}>
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
  const { setup } = school;
  const id = school.school.id;
  const to = (page: string) => consoleSchoolPath(id, page);
  const owned = Boolean(school.ownerEmail || school.invitedOwnerEmail);
  const inSetup = school.school.status === "setup";
  const live = school.school.status === "active";
  return (
    <>
      <Section
        title="Your part"
        description="DriveRush makes the school's cars and hands the school to its owner. That is all staff do."
      >
        <ul className={list}>
          <Step
            done={setup.livery === "live"}
            label="Livery"
            detail={
              setup.livery === "live"
                ? "Published."
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
            label="Owner"
            detail={
              school.ownerEmail
                ? `${school.ownerEmail} owns it.`
                : school.invitedOwnerEmail
                  ? `${school.invitedOwnerEmail} is invited: they own it once they sign up.`
                  : school.expiredOwnerInvite
                    ? `The invite to ${school.expiredOwnerInvite.email} expired on ${EXPIRED.format(new Date(school.expiredOwnerInvite.expiredAt))}: hand it over again.`
                    : "Not handed over yet."
            }
            action={{
              label: inSetup ? "Hand over" : "Change owner",
              to: to("hand-over"),
            }}
          />
        </ul>
      </Section>

      <Section
        title={
          <span className="flex flex-wrap items-center gap-2">
            The owner's part
            {live && setup.ready ? (
              <Badge variant="green">public</Badge>
            ) : (
              <Badge variant="outline">not public yet</Badge>
            )}
          </span>
        }
        description={
          owned
            ? "Done by the owner in the school's own dashboard. The school shows on the site and the board once it has a logo, a profile and an open branch."
            : "Starts once you hand the school over. It shows on the site and the board once its owner has given it a logo, a profile and an open branch."
        }
      >
        <ul className={list}>
          <Step
            done={setup.logo}
            label="Logo"
            detail={setup.logo ? "Uploaded." : "None yet."}
          />
          <Step
            done={setup.profile}
            label="Profile"
            detail={
              setup.profile ? "Filled in." : "No tagline or about text yet."
            }
          />
          <Step
            done={setup.branches > 0}
            label="Branches"
            detail={
              setup.branches > 0
                ? `${setup.branches} ${setup.branches === 1 ? "branch" : "branches"}.`
                : "No branch yet: students are added per branch."
            }
          />
          <Step
            done={setup.payments === "live"}
            label="Bank"
            detail={
              setup.payments === "live"
                ? "Taking payments."
                : setup.payments === "waiting"
                  ? "The owner sent a bank: it is waiting for your check."
                  : "No bank yet. Not needed to be public."
            }
            action={
              setup.payments === "waiting"
                ? { label: "Check the bank", to: to("payments") }
                : undefined
            }
          />
        </ul>
      </Section>
    </>
  );
}
