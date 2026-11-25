/**
 * `/console`: DriveRush staff (su and admin, on a password session).
 *
 *   Schools  every school with its owner, status, branches and students this
 *            month; create a school for an owner's email; suspend, archive or
 *            reactivate; hand a school to another owner; open its dashboard.
 *   Staff    (su only) who holds a staff role; grant or revoke by email.
 *
 * The loader reads `getConsoleOverview`; the action validates each intent
 * and calls the matching `~/database/console` function. The database checks
 * every call again (private.is_staff, private.is_su).
 */
import { data, Link } from "react-router";

import { SiteNav } from "~/components/brand/site-nav";
import {
  CreateSchool,
  SchoolRow,
  StaffPanel,
} from "~/components/console/console-panels";
import { NeedsSignIn, NothingHere } from "~/components/school/signed-out";
import { isStaffRole, isSuRole } from "~/database/auth/roles";
import * as consoleDb from "~/database/console/mutations";
import {
  findAccountIdByEmail,
  getConsoleOverview,
} from "~/database/console/queries";
import type { Result } from "~/database/result";
import { getRequestClient, requireStaff } from "~/lib/auth/require.server";
import { SPONSORS } from "~/lib/board/sponsors";
import { formFields, readFormIntent } from "~/lib/forms/form-intent";
import { dataWithError, dataWithSuccess } from "~/lib/forms/toast.server";
import { validateForm } from "~/lib/forms/validate-form.server";
import {
  ConsoleActionSchema,
  CreateSchoolSchema,
  GrantRoleSchema,
  NO_LIVERY,
  TransferOwnerSchema,
} from "~/schemas/console";

import type { Route } from "./+types/console";

export function meta() {
  return [
    { title: "Console | DriveRush" },
    { name: "robots", content: "noindex" },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const { supabase, headers, caller } = await getRequestClient(request);
  if (!caller.signedIn)
    return data({ state: "signed-out" as const }, { headers });
  if (!isStaffRole(caller.role))
    return data({ state: "not-staff" as const }, { headers });
  const su = isSuRole(caller.role);
  const overview = await getConsoleOverview(supabase, { su });
  return data(
    {
      state: "ok" as const,
      su,
      me: caller.userId,
      sponsors: SPONSORS.map((s) => ({ id: s.id, school: s.school })),
      ...overview,
    },
    { headers },
  );
}

export async function action({ request }: Route.ActionArgs) {
  const { supabase, headers } = await requireStaff(request);
  const formData = await request.formData();
  const intent = readFormIntent(formData);

  const reply = (result: Result<unknown>, message: string) =>
    result.error
      ? dataWithError({ ok: false as const }, result.error, { headers })
      : dataWithSuccess({ ok: true as const }, message, { headers });
  const invalid = (errors: unknown) =>
    dataWithError(
      { ok: false as const, errors },
      "Check the highlighted fields.",
      { headers },
    );
  const noAccount = () =>
    dataWithError(
      { ok: false as const },
      "No account has that email. They sign up first.",
      {
        headers,
      },
    );

  if (intent === "create-school") {
    const { errors, data: v } = await validateForm(
      formData,
      CreateSchoolSchema,
    );
    if (errors || !v) return invalid(errors);
    return reply(
      await consoleDb.createSchool(supabase, {
        name: v.name,
        slug: v.slug,
        sponsorId: v.sponsorId === NO_LIVERY ? null : v.sponsorId,
        ownerEmail: v.ownerEmail,
      }),
      "School created.",
    );
  }

  if (intent === "transfer-owner") {
    const { errors, data: v } = await validateForm(
      formData,
      TransferOwnerSchema,
    );
    if (errors || !v) return invalid(errors);
    const result = await consoleDb.transferSchoolOwner(
      supabase,
      v.schoolId,
      v.email,
    );
    return reply(
      result,
      result.data === "invited"
        ? "Invited: they become owner when they sign up."
        : "New owner set.",
    );
  }

  if (intent === "grant-role") {
    const { errors, data: v } = await validateForm(formData, GrantRoleSchema);
    if (errors || !v) return invalid(errors);
    const userId = await findAccountIdByEmail(supabase, v.email);
    if (!userId) return noAccount();
    return reply(
      await consoleDb.grantPlatformRole(supabase, userId, v.role),
      "Role granted.",
    );
  }

  // Inline actions from keyed fetchers.
  const parsed = ConsoleActionSchema.safeParse(formFields(formData));
  if (!parsed.success) {
    return dataWithError(
      { ok: false as const },
      "Something is missing. Reload and try again.",
      {
        status: 400,
        headers,
      },
    );
  }
  const v = parsed.data;
  if (v.intent === "set-status") {
    return reply(
      await consoleDb.setSchoolStatus(supabase, v.schoolId, v.status),
      "Status saved.",
    );
  }
  const userId = await findAccountIdByEmail(supabase, v.email);
  if (!userId) return noAccount();
  return reply(
    await consoleDb.revokePlatformRole(supabase, userId, v.role),
    "Role revoked.",
  );
}

export default function Console({ loaderData }: Route.ComponentProps) {
  return (
    <>
      <SiteNav />
      <main className="mx-auto min-h-screen w-full max-w-5xl px-5 pb-24 text-ink sm:px-9">
        {loaderData.state === "signed-out" ? (
          <NeedsSignIn
            title="Console"
            body="For DriveRush staff. Sign in with your email and password."
          />
        ) : loaderData.state === "not-staff" ? (
          <NothingHere
            title="Staff only"
            body="This account has no DriveRush staff role, or signed in with a code. Staff sign in with a password."
          />
        ) : (
          <div className="flex flex-col gap-10 py-10">
            <h1 className="font-display text-[28px] font-bold tracking-tight">
              Console
            </h1>
            <section className="flex flex-col gap-4">
              <h2 className="font-display text-[20px] font-bold">Schools</h2>
              <CreateSchool sponsors={loaderData.sponsors} />
              {loaderData.schools.length === 0 ? (
                <p className="text-[14px] text-ink-3">No schools yet.</p>
              ) : (
                <ul className="flex flex-col divide-y divide-line rounded-lg border border-line bg-surface">
                  {loaderData.schools.map((school) => (
                    <SchoolRow
                      key={`${school.id}:${school.status}`}
                      school={school}
                    />
                  ))}
                </ul>
              )}
            </section>
            {loaderData.su && (
              <StaffPanel staff={loaderData.staff} me={loaderData.me} />
            )}
            <p className="text-[13px] text-ink-3">
              A school's dashboard is at{" "}
              <Link to="/school" className="underline">
                /school
              </Link>{" "}
              for its owner and admins; staff open it from the list above.
            </p>
          </div>
        )}
      </main>
    </>
  );
}
