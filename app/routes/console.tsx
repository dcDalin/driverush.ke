/**
 * `/console`: DriveRush staff (su and admin, on a password session).
 *
 *   Schools  every school with its owner, status, branches and students this
 *            month; create a school for an owner's email; suspend, archive or
 *            reactivate; hand a school to another owner; open its dashboard.
 *   Staff    (su only) who holds a staff role; grant or revoke by email.
 *
 * Staff only see this page; the database checks every call again
 * (private.is_staff, private.is_su), so the page only hides what a caller
 * could not do anyway.
 */
import { Link, data, redirect } from "react-router";

import type { Route } from "./+types/console";
import { SiteNav } from "~/components/brand/site-nav";
import {
  CreateSchool,
  SchoolRow,
  StaffPanel,
} from "~/components/console/console-panels";
import { NeedsSignIn, NothingHere } from "~/components/school/signed-out";
import { SPONSORS } from "~/lib/board/sponsors";
import {
  reasonFor,
  signedInRequest,
  type ActionResult,
} from "~/lib/school/server";
import { isStaff } from "~/lib/supabase/caller.server";
import type { AppRole, SchoolRole } from "~/lib/supabase/types";

export function meta() {
  return [
    { title: "Console | DriveRush" },
    { name: "robots", content: "noindex" },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const { supabase, headers, caller } = await signedInRequest(request);
  if (!caller.signedIn)
    return data({ state: "signed-out" as const }, { headers });
  if (!isStaff(caller))
    return data({ state: "not-staff" as const }, { headers });
  const su = caller.role === "driverush_su";

  const [
    { data: schools },
    { data: members },
    { data: branches },
    { data: links },
    roles,
  ] = await Promise.all([
    supabase
      .from("schools")
      .select("id, name, slug, status, sponsor_id, created_at")
      .order("name"),
    supabase.from("school_members").select("school_id, user_id, role"),
    supabase.from("school_branches").select("school_id"),
    supabase
      .from("school_student_links")
      .select("school_id, ends_at")
      .eq("status", "active"),
    su
      ? supabase.from("user_roles").select("user_id, role").neq("role", "user")
      : Promise.resolve({ data: [] as { user_id: string; role: AppRole }[] }),
  ]);

  const owners = (members ?? []).filter(
    (m) => m.role === ("owner" satisfies SchoolRole),
  );
  const userIds = [
    ...new Set([
      ...owners.map((o) => o.user_id),
      ...(roles.data ?? []).map((r) => r.user_id),
    ]),
  ];
  const { data: profiles } = userIds.length
    ? await supabase
        .from("profiles")
        .select("id, email, full_name")
        .in("id", userIds)
    : { data: [] };
  const emailOf = new Map((profiles ?? []).map((p) => [p.id, p.email]));
  const now = Date.now();

  return data(
    {
      state: "ok" as const,
      su,
      me: caller.userId,
      sponsors: SPONSORS.map((s) => ({ id: s.id, school: s.school })),
      schools: (schools ?? []).map((s) => {
        const owner = owners.find((o) => o.school_id === s.id);
        return {
          ...s,
          ownerEmail: owner ? (emailOf.get(owner.user_id) ?? null) : null,
          admins: (members ?? []).filter(
            (m) => m.school_id === s.id && m.role === "admin",
          ).length,
          branches: (branches ?? []).filter((b) => b.school_id === s.id).length,
          students: (links ?? []).filter(
            (l) =>
              l.school_id === s.id && l.ends_at && Date.parse(l.ends_at) > now,
          ).length,
        };
      }),
      staff: (roles.data ?? []).map((r) => ({
        userId: r.user_id,
        role: r.role,
        email: emailOf.get(r.user_id) ?? null,
      })),
    },
    { headers },
  );
}

export async function action({ request }: Route.ActionArgs) {
  const { supabase, headers, caller } = await signedInRequest(request);
  if (!caller.signedIn) throw redirect("/console", { headers });
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "");
  const text = (name: string) => String(form.get(name) ?? "").trim();
  const reply = (result: ActionResult) => data(result, { headers });

  if (intent === "grant-role" || intent === "revoke-role") {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", text("email"))
      .maybeSingle();
    if (!profile)
      return reply({
        ok: false,
        message: "No account has that email. They sign up first.",
      });
    const role = text("role") as AppRole;
    const { error } =
      intent === "grant-role"
        ? await supabase.rpc("grant_platform_role", {
            p_user_id: profile.id,
            p_role: role,
          })
        : await supabase.rpc("revoke_platform_role", {
            p_user_id: profile.id,
            p_role: role,
          });
    return reply(
      error
        ? { ok: false, message: reasonFor(error) }
        : { ok: true, message: "Roles saved." },
    );
  }

  if (intent === "create-school") {
    const { error } = await supabase.rpc("admin_create_school", {
      p_name: text("name"),
      p_slug: text("slug"),
      p_sponsor_id: text("sponsorId") === "none" ? "" : text("sponsorId"),
      p_owner_email: text("ownerEmail"),
    });
    return reply(
      error
        ? { ok: false, message: reasonFor(error) }
        : { ok: true, message: "School created." },
    );
  }

  if (intent === "set-status") {
    const { error } = await supabase.rpc("admin_set_school_status", {
      p_school_id: text("schoolId"),
      p_status: text("status") as "active" | "suspended" | "archived",
    });
    return reply(
      error
        ? { ok: false, message: reasonFor(error) }
        : { ok: true, message: "Status saved." },
    );
  }

  if (intent === "transfer-owner") {
    const { data: outcome, error } = await supabase.rpc(
      "admin_transfer_school_owner",
      {
        p_school_id: text("schoolId"),
        p_email: text("email"),
      },
    );
    if (error) return reply({ ok: false, message: reasonFor(error) });
    return reply({
      ok: true,
      message:
        outcome === "invited"
          ? "Invited: they become owner when they sign up."
          : "New owner set.",
    });
  }

  return data<ActionResult>(
    { ok: false, message: "Unknown action." },
    { status: 400, headers },
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
              <ul className="flex flex-col divide-y divide-line rounded-lg border border-line bg-surface">
                {loaderData.schools.map((school) => (
                  <SchoolRow key={school.id} school={school} />
                ))}
              </ul>
              {loaderData.schools.length === 0 && (
                <p className="text-[14px] text-ink-3">No schools yet.</p>
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
