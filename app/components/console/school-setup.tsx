/**
 * A school's set-up, on its console page: what is done and what it still
 * needs before it goes to its owner. Each step says where it is done and
 * links there: the school's own dashboard for the profile and branches, this
 * page's tabs for the livery and payments, the hand-over modal for the owner.
 */
import { Link } from "react-router";

import { Icon } from "~/components/brand/icon";
import {
  ArrowOutIcon,
  CheckIcon,
  ChevronRightIcon,
  MinusIcon,
} from "~/components/brand/icons";
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
  action: { label: string; to: string; outside?: boolean };
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
      <Button asChild size="sm" variant={done ? "ghost" : "paper"}>
        <Link to={action.to} preventScrollReset={!action.outside}>
          {action.label}
          <Icon
            icon={action.outside ? ArrowOutIcon : ChevronRightIcon}
            size={14}
          />
        </Link>
      </Button>
    </li>
  );
}

export function SetupChecklist({ school }: { school: ConsoleSchool }) {
  const consoleSchoolPath = useConsoleSchoolPath();
  const { setup } = school;
  const id = school.school.id;
  const to = (page: string) => consoleSchoolPath(id, page);
  const owned = Boolean(school.ownerEmail || school.invitedOwnerEmail);
  const inSetup = school.school.status === "setup";
  return (
    <ul className="m-0 flex list-none flex-col divide-y divide-line rounded-lg border border-line bg-surface p-0">
      <Step
        done={setup.profile && setup.logo}
        label="Profile and logo"
        detail={
          setup.profile && setup.logo
            ? "Filled in."
            : setup.profile
              ? "No logo yet."
              : "No tagline or about text yet."
        }
        action={{
          label: "Edit profile",
          to: `/school/${id}/profile`,
          outside: true,
        }}
      />
      <Step
        done={setup.branches > 0}
        label="Branches"
        detail={
          setup.branches > 0
            ? `${setup.branches} ${setup.branches === 1 ? "branch" : "branches"}.`
            : "No branch yet: learners are added per branch."
        }
        action={{
          label: setup.branches > 0 ? "Edit branches" : "Add a branch",
          to: `/school/${id}/branches`,
          outside: true,
        }}
      />
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
        done={setup.payments === "live"}
        label="Payments"
        detail={
          setup.payments === "live"
            ? "Taking payments."
            : setup.payments === "waiting"
              ? "Its owner sent a bank: check it."
              : "No bank yet: its owner sends one from their dashboard, or you set it."
        }
        action={{
          label:
            setup.payments === "waiting" ? "Check the bank" : "Open payments",
          to: to("payments"),
        }}
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
  );
}
