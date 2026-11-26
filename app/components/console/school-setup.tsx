/**
 * One school's set-up in the console: what is done, handing it to its
 * owner, and its status.
 *
 * A school created without an owner is in set-up: hidden from learners,
 * the board and the site. Staff fill in its profile and branches (on the
 * school's dashboard, which staff can open), upload and publish its livery
 * here, then hand it over: the owner's email becomes its owner (added, or
 * invited until they sign up) and the school goes live.
 */
import * as React from "react";
import { Link } from "react-router";
import { HoneypotInputs } from "remix-utils/honeypot/react";

import { Icon } from "~/components/brand/icon";
import { ArrowOutIcon, CheckIcon, MinusIcon } from "~/components/brand/icons";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  CheckboxField,
  InputField,
  ServerFormProvider,
} from "~/components/ui/forms/server";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import type { ConsoleSchool } from "~/database/console/queries";
import type { SchoolStatus } from "~/database/types";
import { useInlineAction } from "~/lib/forms/use-inline-action";
import { useServerForm } from "~/lib/forms/use-server-form";
import { HandOverSchema } from "~/schemas/console";

import { STATUS_LABEL } from "./school-status";

function Step({
  done,
  label,
  detail,
}: {
  done: boolean;
  label: string;
  detail: string;
}) {
  return (
    <li className="flex items-start gap-3">
      <span
        className={
          done
            ? "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-kenya-green text-kenya-green-foreground"
            : "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border border-line text-ink-3"
        }
      >
        <Icon icon={done ? CheckIcon : MinusIcon} size={14} />
      </span>
      <span className="flex flex-col">
        <span className="text-[14px] font-semibold">{label}</span>
        <span className="text-[13px] text-ink-3">{detail}</span>
      </span>
    </li>
  );
}

/** What the school has, and what it still needs before it goes to its owner. */
export function SetupChecklist({ school }: { school: ConsoleSchool }) {
  const { setup } = school;
  const owned = Boolean(school.ownerEmail || school.invitedOwnerEmail);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Set-up</CardTitle>
        <CardDescription>
          {school.school.status === "setup"
            ? "Hidden from learners, the board and the site until you hand it over."
            : "Live. You can still change anything here."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
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
          />
          <Step
            done={setup.branches > 0}
            label="Branches"
            detail={
              setup.branches > 0
                ? `${setup.branches} ${setup.branches === 1 ? "branch" : "branches"}.`
                : "No branch yet: learners are added per branch."
            }
          />
          <Step
            done={setup.livery === "live"}
            label="Livery"
            detail={
              setup.livery === "live"
                ? "Published."
                : setup.livery === "draft"
                  ? "A draft is waiting: preview it, then publish."
                  : "Upload the school's livery folder below."
            }
          />
          <Step
            done={setup.payments === "live"}
            label="Payments"
            detail={
              setup.payments === "live"
                ? "Taking payments."
                : setup.payments === "waiting"
                  ? "Its owner sent a bank: check it on the Payments tab."
                  : "No bank yet: its owner sends one from their dashboard (or set it on the Payments tab)."
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
                  : "Not handed over yet."
            }
          />
        </ul>
        <Button variant="paper" asChild className="self-start">
          <Link to={`/school/${school.school.id}?tab=profile`}>
            Edit profile and branches
            <Icon icon={ArrowOutIcon} size={16} />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

/** Gives the school to its owner, and puts a school in set-up live. */
export function HandOver({ school }: { school: ConsoleSchool }) {
  const inSetup = school.school.status === "setup";
  const form = useServerForm({
    schema: HandOverSchema,
    key: `hand-over:${school.school.id}`,
    resetOnSuccess: true,
    defaultValues: {
      intent: "hand-over",
      schoolId: school.school.id,
      email: "",
      keepPrevious: false,
    },
  });
  const hasOwner = Boolean(school.ownerEmail);
  return (
    <Card>
      <CardHeader>
        <CardTitle>{inSetup ? "Hand over" : "Change owner"}</CardTitle>
        <CardDescription>
          {inSetup
            ? "The owner gets the school's dashboard and the school goes live. Without an account yet, they are invited and own it once they sign up with this email."
            : "The new email becomes the owner. The old owner leaves the school unless you keep them as an admin. Without an account yet, they are invited."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ServerFormProvider methods={form.methods}>
          <form.fetcher.Form
            ref={form.formRef}
            method="post"
            onSubmit={form.methods.handleSubmit}
            noValidate
            className="flex flex-col gap-3"
          >
            <HoneypotInputs />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
              <InputField
                name="email"
                label="Owner's email"
                className="flex-1"
                disabled={form.busy}
                inputProps={{
                  type: "email",
                  inputMode: "email",
                  placeholder: "owner@school.co.ke",
                }}
              />
              <Button
                type="submit"
                variant={inSetup ? "rush" : "paper"}
                className="sm:mt-6"
                isLoading={form.busy}
              >
                {inSetup ? "Hand over and go live" : "Change owner"}
              </Button>
            </div>
            {hasOwner ? (
              <CheckboxField
                name="keepPrevious"
                label={`Keep ${school.ownerEmail} on as an admin of every branch`}
                disabled={form.busy}
              />
            ) : null}
            <p className="m-0 text-[13px] text-ink-3">
              We email them a link to their school.
            </p>
          </form.fetcher.Form>
        </ServerFormProvider>
      </CardContent>
    </Card>
  );
}

/** Active, suspended or archived (set-up ends only by handing over). */
export function SchoolStatusControl({
  schoolId,
  status,
}: {
  schoolId: string;
  status: SchoolStatus;
}) {
  const action = useInlineAction(`school-status:${schoolId}`);
  const [next, setNext] = React.useState<SchoolStatus>(status);
  React.useEffect(() => setNext(status), [status]);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={next}
        onValueChange={(v) => setNext(v as SchoolStatus)}
        disabled={action.busy}
      >
        <SelectTrigger size="sm" className="w-40" aria-label="Status">
          <SelectValue>{STATUS_LABEL[next]}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {status === "setup" ? (
            <SelectItem value="setup" disabled>
              Setting up
            </SelectItem>
          ) : null}
          <SelectItem value="active">Active</SelectItem>
          <SelectItem value="suspended">Suspended</SelectItem>
          <SelectItem value="archived">Archived</SelectItem>
        </SelectContent>
      </Select>
      <Button
        type="button"
        size="sm"
        variant="paper"
        disabled={action.busy || next === status}
        isLoading={action.busy}
        onClick={() =>
          action.submit({ intent: "set-status", schoolId, status: next })
        }
      >
        Save status
      </Button>
      {status === "setup" && next === "active" ? (
        <Badge variant="amber">Goes live with no owner</Badge>
      ) : null}
    </div>
  );
}
