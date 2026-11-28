/**
 * `/pass`: buy the full course (owner, 2026-11-25).
 *
 *   On your own        KES 1,000, 60 days
 *   Through a school   the school's own price (no ceiling), 60 days: the
 *                      learner's own school, a school waiting for them, or
 *                      the school whose code they typed (`?code=HELTZ`, the
 *                      link schools hand out)
 *   30 more days       KES 300, for a learner who has had a pass
 *
 * Paying starts a payment in the database and sends the learner to Paystack
 * (`~/lib/payments/pass-flow.server.ts`); they come back to /pass/done.
 * `?level=` is the level they were on, to go back to.
 */
import { data, Form, Link, redirect } from "react-router";

import {
  kes,
  MoreDays,
  OwnPass,
  SchoolPass,
} from "~/components/account/pass-offers";
import { SiteNav } from "~/components/brand/site-nav";
import { NeedsSignIn, NothingHere } from "~/components/school/signed-out";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  hasHadPass,
  listMyPassOffers,
  listPassPlans,
  passSchoolByCode,
} from "~/database/billing/checkout";
import { getMyEntitlement } from "~/database/entitlement/get-my-entitlement";
import { getRequestClient, requireUser } from "~/lib/auth/require.server";
import { levelById } from "~/lib/board/curriculum";
import { BOARD_PATH, levelHref } from "~/lib/board-guides";
import { readFormIntent } from "~/lib/forms/form-intent";
import { dataWithError } from "~/lib/forms/toast.server";
import { validateForm } from "~/lib/forms/validate-form.server";
import { paymentsEnabled } from "~/lib/payments/env.server";
import { beginCheckout } from "~/lib/payments/pass-flow.server";
import { BuyPassSchema, SchoolCodeSchema } from "~/schemas/billing";

import type { Route } from "./+types/pass";

export function meta() {
  return [
    { title: "Get the full course | DriveRush" },
    { name: "robots", content: "noindex" },
  ];
}

const LEVEL = /^[a-z0-9-]{1,60}$/;

export async function loader({ request, url }: Route.LoaderArgs) {
  const { supabase, headers, caller } = await getRequestClient(request);
  const level = url.searchParams.get("level") ?? "";
  const back = LEVEL.test(level) && levelById(level) ? level : undefined;
  if (!paymentsEnabled()) return data({ state: "off" as const }, { headers });
  if (!caller.signedIn) {
    return data({ state: "signed-out" as const }, { headers });
  }

  const typed = url.searchParams.get("code");
  const code = typed ? SchoolCodeSchema.safeParse(typed) : null;
  const [plans, entitlement, offers, hadPass, codeOffer] = await Promise.all([
    listPassPlans(supabase),
    getMyEntitlement(supabase),
    listMyPassOffers(supabase),
    hasHadPass(supabase, caller.userId),
    code?.success ? passSchoolByCode(supabase, code.data) : null,
  ]);
  const plan = (c: string) => plans.find((p) => p.code === c);
  return data(
    {
      state: "ok" as const,
      level: back,
      own: plan("learner_pass"),
      school: plan("school_pass"),
      more: hadPass ? plan("learner_extension") : undefined,
      passEndsAt: entitlement?.pass_ends_at ?? null,
      offers,
      typed: typed ?? "",
      code: code?.success ? code.data : null,
      codeOffer,
    },
    { headers },
  );
}

export async function action({ request, url }: Route.ActionArgs) {
  const { supabase, headers } = await requireUser(request);
  const formData = await request.formData();
  if (readFormIntent(formData) !== "buy") {
    return dataWithError({ ok: false as const }, "Reload and try again.", {
      status: 400,
      headers,
    });
  }
  const { errors, data: values } = await validateForm(formData, BuyPassSchema);
  if (errors || !values) {
    return dataWithError(
      { ok: false as const, errors },
      "Check the highlighted fields.",
      { headers },
    );
  }
  const started = await beginCheckout(supabase, values, url.href);
  if (started.error !== null) {
    return dataWithError({ ok: false as const }, started.error, { headers });
  }
  // Off to Paystack's page; it sends them back to /pass/done.
  return redirect(started.data.url, { headers });
}

const dateSaid = (iso: string) =>
  new Intl.DateTimeFormat("en-KE", {
    timeZone: "Africa/Nairobi",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));

export default function Pass({ loaderData }: Route.ComponentProps) {
  if (loaderData.state === "off") {
    return (
      <Shell>
        <NothingHere
          title="The full course"
          body="Passes are not on sale yet. Every level, both sign trainers and the guides are free."
        />
      </Shell>
    );
  }
  if (loaderData.state === "signed-out") {
    return (
      <Shell>
        <NeedsSignIn
          title="Get the full course"
          body="Sign in first: your pass is kept on your account, on every phone you use."
        />
      </Shell>
    );
  }
  const d = loaderData;
  const back = d.level ? levelHref(d.level) : BOARD_PATH;
  const days = d.own?.days ?? 60;
  const linked = d.offers.filter((o) => o.linked);
  const waiting = d.offers.filter((o) => !o.linked);
  const typedIsOffered = d.offers.some((o) => o.code === d.code);
  return (
    <Shell>
      <div className="mx-auto flex max-w-xl flex-col gap-6 py-10">
        <header className="flex flex-col gap-2">
          <h1 className="font-display text-[28px] font-bold tracking-tight">
            Get the full course
          </h1>
          <p className="m-0 text-ink-2">
            All 59 levels of the Model Town Board and every mock test. One
            payment by M-Pesa or card, for {days} days.
          </p>
          {d.passEndsAt && (
            <p className="m-0 rounded-soft border border-success-line bg-success-soft px-3 py-2 text-[14px] font-semibold text-success-strong">
              Your pass runs to {dateSaid(d.passEndsAt)}.
            </p>
          )}
        </header>

        {d.school &&
          linked.map((o) => (
            <SchoolPass
              key={`${o.school_id}:${o.branch_id}`}
              schoolName={o.school_name}
              code={o.code}
              price={o.price_kes}
              days={d.school?.days ?? days}
              branchId={o.branch_id}
              branchName={o.branch_name}
              level={d.level}
              linked
            />
          ))}

        {d.more && d.passEndsAt && (
          <MoreDays
            price={d.more.price_kes}
            days={d.more.days}
            level={d.level}
          />
        )}

        {d.school &&
          waiting.map((o) => (
            <SchoolPass
              key={`${o.school_id}:${o.branch_id}`}
              schoolName={o.school_name}
              code={o.code}
              price={o.price_kes}
              days={d.school?.days ?? days}
              branchId={o.branch_id}
              branchName={o.branch_name}
              level={d.level}
            />
          ))}

        {d.school && d.codeOffer && !typedIsOffered && d.code && (
          <SchoolPass
            schoolName={d.codeOffer.school_name}
            code={d.code}
            price={d.codeOffer.price_kes}
            days={d.school.days}
            branches={d.codeOffer.branches}
            level={d.level}
          />
        )}

        <SchoolCodeForm
          typed={d.typed}
          level={d.level}
          notFound={Boolean(d.typed) && !d.codeOffer}
        />

        {d.own && (
          <OwnPass price={d.own.price_kes} days={d.own.days} level={d.level} />
        )}

        {d.more && !d.passEndsAt && (
          <MoreDays
            price={d.more.price_kes}
            days={d.more.days}
            level={d.level}
          />
        )}

        <p className="m-0 text-[13px] text-ink-3">
          You pay on Paystack's page: approve the M-Pesa prompt on your phone,
          or use a card.
          {d.school?.driverush_share_kes
            ? ` A school pass costs what your school set; DriveRush keeps ${kes(d.school.driverush_share_kes)} of it.`
            : ""}
        </p>
        <Button asChild variant="paper" className="self-start">
          <Link to={back}>
            {d.level ? "Back to the level" : "Back to the board"}
          </Link>
        </Button>
      </div>
    </Shell>
  );
}

/** A school's code: opens that school's price and branches (a plain GET). */
function SchoolCodeForm({
  typed,
  level,
  notFound,
}: {
  typed: string;
  level?: string;
  notFound: boolean;
}) {
  return (
    <Form
      method="get"
      className="flex flex-col gap-2 rounded-soft border border-line bg-surface p-4"
    >
      <Label htmlFor="school-code">Learning at a driving school?</Label>
      <p className="m-0 text-[13px] text-ink-3">
        Type its DriveRush code: your school sets the price and sees your
        progress.
      </p>
      {level && <input type="hidden" name="level" value={level} />}
      <div className="flex gap-2">
        <Input
          id="school-code"
          name="code"
          defaultValue={typed}
          placeholder="HELTZ"
          autoCapitalize="characters"
          autoComplete="off"
          className="w-40 uppercase"
          aria-invalid={notFound || undefined}
          aria-describedby={notFound ? "school-code-error" : undefined}
        />
        <Button type="submit" variant="paper">
          Find my school
        </Button>
      </div>
      {notFound && (
        <p
          id="school-code-error"
          className="m-0 text-[13px] text-danger-strong"
        >
          No school takes payments with that code. Check it with your school.
        </p>
      )}
    </Form>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteNav />
      <main className="mx-auto min-h-screen w-full max-w-5xl px-5 pb-24 text-ink sm:px-9">
        {children}
      </main>
    </>
  );
}
