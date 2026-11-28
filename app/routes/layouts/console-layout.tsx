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
import { data, Outlet } from "react-router";

import { SiteNav } from "~/components/brand/site-nav";
import { ConsoleShell } from "~/components/console/shell";
import { FrameError } from "~/components/school/frame-error";
import { NeedsSignIn, NothingHere } from "~/components/school/signed-out";
import { listBankRequests } from "~/database/billing/school";
import { privatePage } from "~/lib/auth/private-page.server";
import { getRequestClient, requireStaff } from "~/lib/auth/require.server";
import { useRevalidateOnSession } from "~/lib/auth/use-revalidate-on-session";
import { consoleAction } from "~/lib/console/action.server";
import { consoleGate } from "~/lib/console/gate.server";
import { useLiveRevalidate } from "~/lib/realtime/use-live-revalidate";
import { oncePerRequest } from "~/lib/server/once-per-request";
import { frameShouldRevalidate } from "~/lib/ui/frame-revalidate";

import type { Route } from "./+types/console-layout";

export function meta() {
  return [
    { title: "Console | DriveRush" },
    { name: "robots", content: "noindex" },
  ];
}

/** About one person: never kept by a cache. */
export const middleware: Route.MiddlewareFunction[] = [privatePage];

export async function loader({ request }: Route.LoaderArgs) {
  const context = await getRequestClient(request);
  const gate = await consoleGate(context);
  const { headers } = context;
  if (!gate.ok) return data({ state: gate.state }, { headers });
  // A failed count drops the badge, never the console.
  const banks = await oncePerRequest(request, "bank-requests", () =>
    listBankRequests(context.supabase),
  ).catch(() => []);
  return data(
    { state: "ok" as const, su: gate.su, badges: { banks: banks.length } },
    { headers },
  );
}

export async function action({ request }: Route.ActionArgs) {
  const staff = await requireStaff(request);
  return consoleAction(staff, await request.formData(), request);
}

/** Moving about inside the frame reads nothing again (`frameShouldRevalidate`). */
export const shouldRevalidate = frameShouldRevalidate;

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

/** A failed page or change, inside the dashboard's words (`FrameError`). */
export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return (
    <>
      <SiteNav />
      <main className="mx-auto min-h-screen w-full max-w-5xl px-5 pb-24 text-ink sm:px-9">
        <FrameError error={error} />
      </main>
    </>
  );
}
