/**
 * Reads for the DriveRush console. Staff read every school, member, branch
 * and link through row level security; a su also reads every staff role.
 * Reads throw.
 */
import { orThrow } from "../result";
import type { AppRole, SchoolStatus, TypedSupabaseClient } from "../types";

export type ConsoleSchool = {
  id: string;
  name: string;
  slug: string;
  status: SchoolStatus;
  sponsor_id: string | null;
  ownerEmail: string | null;
  admins: number;
  branches: number;
  students: number;
};

export type StaffMember = {
  userId: string;
  role: AppRole;
  email: string | null;
};

export async function getConsoleOverview(
  supabase: TypedSupabaseClient,
  { su, now = Date.now() }: { su: boolean; now?: number },
): Promise<{ schools: ConsoleSchool[]; staff: StaffMember[] }> {
  const [schools, members, branches, links, roles] = await Promise.all([
    supabase
      .from("schools")
      .select("id, name, slug, status, sponsor_id")
      .order("name")
      .then(orThrow),
    supabase
      .from("school_members")
      .select("school_id, user_id, role")
      .then(orThrow),
    supabase.from("school_branches").select("school_id").then(orThrow),
    supabase
      .from("school_student_links")
      .select("school_id, ends_at")
      .eq("status", "active")
      .then(orThrow),
    su
      ? supabase
          .from("user_roles")
          .select("user_id, role")
          .neq("role", "user")
          .then(orThrow)
      : Promise.resolve([] as { user_id: string; role: AppRole }[]),
  ]);

  const owners = members.filter((m) => m.role === "owner");
  const ids = [
    ...new Set([
      ...owners.map((o) => o.user_id),
      ...roles.map((r) => r.user_id),
    ]),
  ];
  const profiles = ids.length
    ? orThrow(await supabase.from("profiles").select("id, email").in("id", ids))
    : [];
  const emailOf = new Map(profiles.map((p) => [p.id, p.email]));

  return {
    schools: schools.map((s) => {
      const owner = owners.find((o) => o.school_id === s.id);
      return {
        ...s,
        ownerEmail: owner ? (emailOf.get(owner.user_id) ?? null) : null,
        admins: members.filter(
          (m) => m.school_id === s.id && m.role === "admin",
        ).length,
        branches: branches.filter((b) => b.school_id === s.id).length,
        students: links.filter(
          (l) =>
            l.school_id === s.id &&
            l.ends_at !== null &&
            Date.parse(l.ends_at) > now,
        ).length,
      };
    }),
    staff: roles.map((r) => ({
      userId: r.user_id,
      role: r.role,
      email: emailOf.get(r.user_id) ?? null,
    })),
  };
}

/** The account with this email (staff read every profile), or null. */
export async function findAccountIdByEmail(
  supabase: TypedSupabaseClient,
  email: string,
) {
  const row = orThrow(
    await supabase
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle(),
  );
  return row?.id ?? null;
}
