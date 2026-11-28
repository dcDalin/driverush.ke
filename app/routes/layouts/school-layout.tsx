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
import * as React from "react";
import {
  data,
  Link,
  Outlet,
  type ShouldRevalidateFunctionArgs,
  useRevalidator,
} from "react-router";

import { SiteNav } from "~/components/brand/site-nav";
import { DashShell } from "~/components/console/shell";
import { NeedsSignIn, NothingHere } from "~/components/school/signed-out";
import { Button } from "~/components/ui/button";
import { getRequestClient, requireUser } from "~/lib/auth/require.server";
import { useSession } from "~/lib/auth/session";
import { useLiveRevalidate } from "~/lib/realtime/use-live-revalidate";
import { schoolAction } from "~/lib/school/action.server";
import { loadSchool } from "~/lib/school/load.server";
import { schoolNav, schoolPath } from "~/lib/school/nav";

import type { Route } from "./+types/school-layout";

export function meta({ data: loaded }: Route.MetaArgs) {
  const name = loaded && loaded.state === "ok" ? loaded.school.name : "School";
  return [
    { title: `${name} | School dashboard | DriveRush` },
    { name: "robots", content: "noindex" },
  ];
}

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

/**
 * The lists filter in the browser, with their search in the address: a
 * change of search alone reads nothing new. Everything else (a submitted
 * form, a live update, another school) asks again.
 */
export function shouldRevalidate({
  currentUrl,
  nextUrl,
  formMethod,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs) {
  const onlySearch =
    !formMethod &&
    currentUrl.pathname === nextUrl.pathname &&
    currentUrl.search !== nextUrl.search;
  return onlySearch ? false : defaultShouldRevalidate;
}

/** Signing in or out happens in the browser, on this page: ask again. */
function useRevalidateOnSession() {
  const session = useSession();
  const { revalidate } = useRevalidator();
  const seen = React.useRef<typeof session | null>(null);
  React.useEffect(() => {
    if (session.status === "loading" || session.status === "off") return;
    const first = seen.current === null;
    seen.current = session;
    if (!first) void revalidate();
  }, [session, revalidate]);
}

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
  const { school, canManage, passInfo, role } = loaderData;
  const bankNeeded =
    canManage && !passInfo?.ready && !passInfo?.pending_bank_label;
  return (
    <DashShell
      home={schoolPath(school.id)}
      title={school.name}
      tag="School"
      groups={schoolNav(school.id, { canManage, bankNeeded })}
      roleLabel={ROLE_LABEL[role]}
    >
      <Outlet />
    </DashShell>
  );
}
