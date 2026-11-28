/**
 * A driving school's dashboard, as a frame (side menu, top bar) around one
 * page per section, the way the console is built:
 *
 *   /school/:schoolId               Overview: what needs you, the numbers
 *   /school/:schoolId/students      everyone added, progress and passes
 *   /school/:schoolId/students/add  "Add student", a modal over the list
 *   /school/:schoolId/passes        code and link, price, bank, earnings
 *   /school/:schoolId/team          (owner) the owner and admins
 *   /school/:schoolId/team/add      "Add admin", a modal over the list
 *   /school/:schoolId/branches      (owner) rename, close
 *   /school/:schoolId/branches/add  "Add branch", a modal over the list
 *   /school/:schoolId/profile       (owner, staff) what learners read
 *
 * The frame's loader reads everything once (`loadSchool`); the pages have no
 * loader and read it through `useSchool()`. Every route's action opens with
 * `requireUser` and hands over to `schoolAction`. A change revalidates the
 * frame, so every open page follows; typing in a list's search does not.
 */
import { data, Link, Outlet } from "react-router";

import { SiteNav } from "~/components/brand/site-nav";
import { DashShell } from "~/components/console/shell";
import { FrameError } from "~/components/school/frame-error";
import { NeedsSignIn, NothingHere } from "~/components/school/signed-out";
import { Button } from "~/components/ui/button";
import { privatePage } from "~/lib/auth/private-page.server";
import { getRequestClient, requireUser } from "~/lib/auth/require.server";
import { useRevalidateOnSession } from "~/lib/auth/use-revalidate-on-session";
import { useLiveRevalidate } from "~/lib/realtime/use-live-revalidate";
import { schoolAction } from "~/lib/school/action.server";
import { loadSchool } from "~/lib/school/load.server";
import { schoolNav, schoolPath } from "~/lib/school/nav";
import { frameShouldRevalidate } from "~/lib/ui/frame-revalidate";

import type { Route } from "./+types/school-layout";

export function meta({ loaderData: loaded }: Route.MetaArgs) {
  const name = loaded && loaded.state === "ok" ? loaded.school.name : "School";
  return [
    { title: `${name} | School dashboard | DriveRush` },
    { name: "robots", content: "noindex" },
  ];
}

/** About one person: never kept by a cache. */
export const middleware: Route.MiddlewareFunction[] = [privatePage];

export async function loader({ request, params }: Route.LoaderArgs) {
  const context = await getRequestClient(request);
  return data(await loadSchool(context, params.schoolId), {
    headers: context.headers,
  });
}

export async function action({ request, params }: Route.ActionArgs) {
  const context = await requireUser(request);
  return schoolAction(context, params.schoolId, request);
}

/** Moving about inside the frame reads nothing again (`frameShouldRevalidate`). */
export const shouldRevalidate = frameShouldRevalidate;

const ROLE_LABEL = {
  owner: "School owner",
  admin: "Branch admin",
} as const;

export default function SchoolLayout({ loaderData }: Route.ComponentProps) {
  const ok = loaderData.state === "ok";
  useLiveRevalidate(ok ? [`school:${loaderData.school.id}`] : []);
  useRevalidateOnSession();
  if (!ok) {
    return (
      <>
        <SiteNav />
        <main className="mx-auto min-h-screen w-full max-w-5xl px-5 pb-24 text-ink sm:px-9">
          {loaderData.state === "signed-out" ? (
            <NeedsSignIn
              title="School dashboard"
              body="Sign in with the email your school added you with to see your students and their progress."
            />
          ) : loaderData.state === "staff" ? (
            <section className="mx-auto flex max-w-md flex-col items-start gap-4 py-16">
              <h1 className="font-display text-[28px] font-bold tracking-tight">
                This is the school's own dashboard
              </h1>
              <p className="text-ink-2">
                DriveRush staff set a school up, hand it to its owner and look
                inside it from the console. Only the school's owner and admins
                work here.
              </p>
              <Button asChild variant="rush">
                <Link to={`/console/schools/${loaderData.schoolId}`}>
                  Open it in the console
                </Link>
              </Button>
            </section>
          ) : (
            <NothingHere
              title="Not your school"
              body="This account is not an owner or admin of this school."
            />
          )}
        </main>
      </>
    );
  }
  const { school, canManage, passInfo, role, paymentsOn } = loaderData;
  // Only while passes are on sale: until then there is nothing to be paid.
  const bankNeeded =
    paymentsOn &&
    canManage &&
    !passInfo?.ready &&
    !passInfo?.pending_bank_label;
  return (
    <DashShell
      home={schoolPath(school.id)}
      title={school.name}
      tag="School"
      groups={schoolNav(school.id, { canManage, bankNeeded })}
      roleLabel={role === "staff" ? "DriveRush staff" : ROLE_LABEL[role]}
    >
      <Outlet />
    </DashShell>
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
