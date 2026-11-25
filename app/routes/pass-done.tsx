/**
 * `/pass/done`: where Paystack sends the learner after paying
 * (`?reference=dr_…`, plus our `?level=`).
 *
 * We ask Paystack how the payment ended and settle it (the webhook may have
 * done it already; settling twice changes nothing). Then: their pass and its
 * end date, still waiting for the M-Pesa prompt, or it did not go through.
 * Only the learner who started the payment can open it.
 */
import * as React from "react";
import { data, Link } from "react-router";

import { SiteNav } from "~/components/brand/site-nav";
import { NeedsSignIn } from "~/components/school/signed-out";
import { Button } from "~/components/ui/button";
import { getMyPayment } from "~/database/billing/checkout";
import { getMyEntitlement } from "~/database/entitlement/get-my-entitlement";
import { refreshEntitlement } from "~/lib/auth/entitlement";
import { getRequestClient } from "~/lib/auth/require.server";
import { useSession } from "~/lib/auth/session";
import { levelById } from "~/lib/board/curriculum";
import { BOARD_PATH, levelHref } from "~/lib/board-guides";
import { paymentsEnabled } from "~/lib/payments/env.server";
import { confirmPayment } from "~/lib/payments/pass-flow.server";
import { SITE } from "~/lib/site";

import type { Route } from "./+types/pass-done";

export function meta() {
  return [
    { title: "Your pass | DriveRush" },
    { name: "robots", content: "noindex" },
  ];
}

const REFERENCE = /^dr_[A-Za-z0-9_]{1,64}$/;

export async function loader({ request }: Route.LoaderArgs) {
  const { supabase, headers, caller } = await getRequestClient(request);
  const url = new URL(request.url);
  const level = url.searchParams.get("level") ?? "";
  const back = levelById(level) ? level : null;
  const reference =
    url.searchParams.get("reference") ?? url.searchParams.get("trxref") ?? "";
  if (!caller.signedIn)
    return data({ state: "signed-out" as const, back }, { headers });
  if (!paymentsEnabled() || !REFERENCE.test(reference)) {
    return data({ state: "missing" as const, back }, { headers });
  }
  const payment = await getMyPayment(supabase, reference);
  if (!payment) return data({ state: "missing" as const, back }, { headers });

  let state: "paid" | "waiting" | "failed" | "problem" | "refunded";
  if (payment.status === "succeeded") state = "paid";
  else if (payment.status === "refunded") state = "refunded";
  else {
    const confirmed = await confirmPayment(reference);
    state = confirmed.outcome;
  }
  const entitlement =
    state === "paid" ? await getMyEntitlement(supabase) : null;
  return data(
    {
      state,
      back,
      passEndsAt: entitlement?.pass_ends_at ?? null,
      retry: `/pass${back ? `?level=${back}` : ""}`,
    },
    { headers },
  );
}

const dateSaid = (iso: string) =>
  new Intl.DateTimeFormat("en-KE", {
    timeZone: "Africa/Nairobi",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));

export default function PassDone({ loaderData }: Route.ComponentProps) {
  const d = loaderData;
  const session = useSession();
  const userId = session.status === "signed-in" ? session.user.id : null;
  // The browser's copy of what the learner gets, so the board opens at once.
  React.useEffect(() => {
    if (d.state === "paid" && userId) void refreshEntitlement(userId);
  }, [d.state, userId]);

  const next = d.back ? levelHref(d.back) : BOARD_PATH;
  const nextLabel = d.back
    ? `Go to level ${levelById(d.back)?.n ?? ""}`.trim()
    : "Go to the board";

  return (
    <>
      <SiteNav />
      <main className="mx-auto min-h-screen w-full max-w-5xl px-5 pb-24 text-ink sm:px-9">
        {d.state === "signed-out" ? (
          <NeedsSignIn
            title="Your pass"
            body="Sign in with the account you paid from to see your pass."
          />
        ) : (
          <section className="mx-auto flex max-w-md flex-col items-start gap-4 py-16">
            {d.state === "paid" && (
              <>
                <h1 className="font-display text-[28px] font-bold tracking-tight">
                  You have the full course
                </h1>
                <p className="m-0 text-ink-2">
                  {"passEndsAt" in d && d.passEndsAt
                    ? `Your pass runs to ${dateSaid(d.passEndsAt)}. Every level and mock test is open.`
                    : "Every level and mock test is open."}
                </p>
                <Button asChild variant="rush">
                  <Link to={next} replace>
                    {nextLabel}
                  </Link>
                </Button>
              </>
            )}
            {d.state === "waiting" && (
              <>
                <h1 className="font-display text-[28px] font-bold tracking-tight">
                  Waiting for M-Pesa
                </h1>
                <p className="m-0 text-ink-2">
                  Approve the prompt on your phone with your M-Pesa PIN. This
                  page knows once it goes through.
                </p>
                <Button asChild variant="rush">
                  <Link to="." reloadDocument>
                    Check again
                  </Link>
                </Button>
              </>
            )}
            {d.state === "failed" && (
              <>
                <h1 className="font-display text-[28px] font-bold tracking-tight">
                  The payment did not go through
                </h1>
                <p className="m-0 text-ink-2">
                  Nothing was taken. You can try again, by M-Pesa or card.
                </p>
                <Button asChild variant="rush">
                  <Link to={"retry" in d ? d.retry : "/pass"}>Try again</Link>
                </Button>
              </>
            )}
            {(d.state === "problem" || d.state === "refunded") && (
              <>
                <h1 className="font-display text-[28px] font-bold tracking-tight">
                  {d.state === "refunded"
                    ? "This payment was refunded"
                    : "We need to look at this payment"}
                </h1>
                <p className="m-0 text-ink-2">
                  {d.state === "refunded"
                    ? "The money went back to you, so this pass is off."
                    : "Paystack has your payment, but our side could not add your pass. Write to us and we will sort it out."}{" "}
                  <a
                    className="underline"
                    href={`mailto:${SITE.contact.email}`}
                  >
                    {SITE.contact.email}
                  </a>
                </p>
              </>
            )}
            {d.state === "missing" && (
              <>
                <h1 className="font-display text-[28px] font-bold tracking-tight">
                  No payment here
                </h1>
                <p className="m-0 text-ink-2">
                  This link is not for a payment on this account.
                </p>
                <Button asChild variant="paper">
                  <Link to="/pass">See the passes</Link>
                </Button>
              </>
            )}
          </section>
        )}
      </main>
    </>
  );
}
