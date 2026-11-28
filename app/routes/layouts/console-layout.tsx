/**
 * The console's frame, around every page under `/console`: DriveRush staff
 * (su and admin, on a password or Google session) get the side menu and the
 * page; anyone else gets the reason, and a way to sign in where that helps.
 *
 *   /console                    Overview: what needs you, the numbers
 *   /console/schools            every school (search, filters, pages)
 *   /console/schools/new        "New school", a modal over the list
 *   /console/schools/:schoolId  one school
 *   /console/payments           banks to check, totals, every payment
 *   /console/staff              (su) who holds a staff role
 *   /console/staff/grant        "Add staff", a modal over the list
 *
 * The frame's own loader is small: who is here, and the menu's badges. Each
 * page gates itself too (a data request can run a page without this one).
 * A change anywhere in the console revalidates every open console page.
 */
import { data, Outlet, type ShouldRevalidateFunctionArgs } from "react-router";

import { SiteNav } from "~/components/brand/site-nav";
import { ConsoleShell } from "~/components/console/shell";
import { NeedsSignIn, NothingHere } from "~/components/school/signed-out";
import { listBankRequests } from "~/database/billing/school";
import { getRequestClient, requireStaff } from "~/lib/auth/require.server";
import { useRevalidateOnSession } from "~/lib/auth/use-revalidate-on-session";
import { consoleAction } from "~/lib/console/action.server";
import { consoleGate } from "~/lib/console/gate.server";
import { useLiveRevalidate } from "~/lib/realtime/use-live-revalidate";

import type { Route } from "./+types/console-layout";

export function meta() {
  return [
    { title: "Console | DriveRush" },
    { name: "robots", content: "noindex" },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const context = await getRequestClient(request);
  const gate = await consoleGate(context);
  const { headers } = context;
  if (!gate.ok) return data({ state: gate.state }, { headers });
  // A failed count drops the badge, never the console.
  const banks = await listBankRequests(context.supabase).catch(() => []);
  return data(
    { state: "ok" as const, su: gate.su, badges: { banks: banks.length } },
    { headers },
  );
}

export async function action({ request }: Route.ActionArgs) {
  const staff = await requireStaff(request);
  return consoleAction(staff, await request.formData(), request);
}

/**
 * Moving between pages of the same frame (its tabs, a modal over a tab)
 * re-reads nothing here; a saved form, a live update or a revalidate does.
 */
export function shouldRevalidate({
  currentUrl,
  nextUrl,
  currentParams,
  nextParams,
  formMethod,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs) {
  const sameFrame =
    !formMethod &&
    currentUrl.pathname !== nextUrl.pathname &&
    currentParams.schoolId === nextParams.schoolId &&
    currentUrl.searchParams.get("q") === nextUrl.searchParams.get("q");
  return sameFrame ? false : defaultShouldRevalidate;
}

export default function ConsoleLayout({ loaderData }: Route.ComponentProps) {
  useLiveRevalidate(loaderData.state === "ok" ? ["console"] : []);
  useRevalidateOnSession();
  if (loaderData.state === "ok") {
    return (
      <ConsoleShell su={loaderData.su} badges={loaderData.badges}>
        <Outlet />
      </ConsoleShell>
    );
  }
  return (
    <>
      <SiteNav />
      <main className="mx-auto min-h-screen w-full max-w-5xl px-5 pb-24 text-ink sm:px-9">
        {loaderData.state === "signed-out" ? (
          <NeedsSignIn
            title="Console"
            body="For DriveRush staff. Sign in with Google or your email and password."
          />
        ) : loaderData.state === "sign-in-again" ? (
          <NeedsSignIn
            title="Sign in again"
            body="You are DriveRush staff, but this visit started with an emailed code, as a password reset does. Sign in again with Google or your password to open the console."
          />
        ) : (
          <NothingHere
            title="Staff only"
            body="This account has no DriveRush staff role."
          />
        )}
      </main>
    </>
  );
}
