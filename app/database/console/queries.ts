/**
 * Reads for the DriveRush console. Staff read every school through
 * `admin_list_schools` (one page at a time, searched and filtered in the
 * database) and one school's details through row level security; a su also
 * reads every staff role. Reads throw.
 */
import { orThrow } from "../result";
import { schoolReadiness } from "../schools/readiness";
import type {
  AppRole,
  Enums,
  FunctionReturns,
  SchoolStatus,
  TypedSupabaseClient,
} from "../types";

export const CONSOLE_PAGE_SIZE = 20;

export type SchoolFilters = {
  search: string;
  status: "any" | SchoolStatus;
  livery: "any" | "live" | "draft" | "none";
  sponsoring: "any" | "yes" | "no";
  page: number;
};

export type ConsoleSchoolRow = Omit<
  FunctionReturns<"admin_list_schools">[number],
  "total" | "owner_email" | "invited_owner_email"
> & {
  owner_email: string | null;
  invited_owner_email: string | null;
  livery: "live" | "draft" | "none";
};

/** One page of schools, with how many match in all. */
export async function listConsoleSchools(
  supabase: TypedSupabaseClient,
  filters: SchoolFilters,
) {
  const rows = orThrow(
    await supabase.rpc("admin_list_schools", {
      p_search: filters.search,
      p_status: filters.status,
      p_livery: filters.livery,
      p_sponsoring: filters.sponsoring,
      p_limit: CONSOLE_PAGE_SIZE,
      p_offset: (filters.page - 1) * CONSOLE_PAGE_SIZE,
    }),
  );
  const total = Number(rows[0]?.total ?? 0);
  return {
    schools: rows.map(
      ({ total: _, ...row }) => row as unknown as ConsoleSchoolRow,
    ),
    total,
    pages: Math.max(1, Math.ceil(total / CONSOLE_PAGE_SIZE)),
  };
}

export type ConsoleLivery = {
  id: string;
  status: Enums<"livery_status">;
  label: string;
  created_at: string;
  published_at: string | null;
};

export type ConsoleSponsorship = {
  id: string;
  starts_on: string;
  ends_on: string | null;
  note: string | null;
};

/**
 * One school for its console page: who owns it (or is invited to), its
 * liveries and sponsorships, and what its set-up still lacks.
 */
export async function getConsoleSchool(
  supabase: TypedSupabaseClient,
  schoolId: string,
) {
  // At most two round trips: the school and everything about it at once,
  // then the owner's email once their id is known (in the same batch).
  const [
    school,
    ownerEmail,
    invite,
    liveries,
    sponsorships,
    branches,
    profile,
    payments,
  ] = await Promise.all([
    supabase
      .from("schools")
      .select("id, name, slug, status, created_at")
      .eq("id", schoolId)
      .maybeSingle()
      .then(orThrow),
    supabase
      .from("school_members")
      .select("user_id")
      .eq("school_id", schoolId)
      .eq("role", "owner")
      .maybeSingle()
      .then(orThrow)
      .then(async (owner) =>
        owner
          ? (orThrow(
              await supabase
                .from("profiles")
                .select("email")
                .eq("id", owner.user_id)
                .maybeSingle(),
            )?.email ?? null)
          : null,
      ),
    supabase
      .from("school_member_invites")
      .select("email, expires_at")
      .eq("school_id", schoolId)
      .eq("role", "owner")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(orThrow),
    supabase
      .from("school_liveries")
      .select("id, status, label, created_at, published_at")
      .eq("school_id", schoolId)
      .order("created_at", { ascending: false })
      .then(orThrow),
    supabase
      .from("school_sponsorships")
      .select("id, starts_on, ends_on, note")
      .eq("school_id", schoolId)
      .order("starts_on", { ascending: false })
      .then(orThrow),
    supabase
      .from("school_branches")
      .select("is_active")
      .eq("school_id", schoolId)
      .then(orThrow),
    supabase
      .from("school_profiles")
      .select("tagline, about, logo, logo_mono")
      .eq("school_id", schoolId)
      .maybeSingle()
      .then(orThrow),
    supabase
      .rpc("school_pass_info", { p_school_id: schoolId })
      .then(orThrow)
      .then((rows) => rows[0] ?? null),
  ]);
  if (!school) return null;

  const ready = schoolReadiness({
    logo: profile?.logo,
    tagline: profile?.tagline,
    about: profile?.about,
    openBranches: branches.filter((b) => b.is_active).length,
  });
  return {
    school,
    ownerEmail,
    // A lapsed owner invite is no owner: staff hand the school over again.
    invitedOwnerEmail:
      invite && Date.parse(invite.expires_at) > Date.now()
        ? invite.email
        : null,
    expiredOwnerInvite:
      invite && Date.parse(invite.expires_at) <= Date.now()
        ? { email: invite.email, expiredAt: invite.expires_at }
        : null,
    liveries: liveries as ConsoleLivery[],
    sponsorships: sponsorships as ConsoleSponsorship[],
    payments,
    setup: {
      payments: payments?.ready
        ? ("live" as const)
        : payments?.pending_bank_label
          ? ("waiting" as const)
          : ("none" as const),
      profile: ready.profile,
      logo: ready.logo,
      branches: branches.length,
      /** Public once active: a logo, profile text and an open branch. */
      ready: ready.ready,
      livery: liveries.some((l) => l.status === "live")
        ? ("live" as const)
        : liveries.some((l) => l.status === "draft")
          ? ("draft" as const)
          : ("none" as const),
    },
  };
}

export type ConsoleSchool = NonNullable<
  Awaited<ReturnType<typeof getConsoleSchool>>
>;

export type StaffMember = {
  userId: string;
  role: AppRole;
  email: string | null;
};

/** Everyone with a staff role (su only: row level security). */
export async function listStaff(
  supabase: TypedSupabaseClient,
): Promise<StaffMember[]> {
  const roles = orThrow(
    await supabase
      .from("user_roles")
      .select("user_id, role")
      .neq("role", "user"),
  );
  const ids = [...new Set(roles.map((r) => r.user_id))];
  const profiles = ids.length
    ? orThrow(await supabase.from("profiles").select("id, email").in("id", ids))
    : [];
  const emailOf = new Map(profiles.map((p) => [p.id, p.email]));
  return roles.map((r) => ({
    userId: r.user_id,
    role: r.role,
    email: emailOf.get(r.user_id) ?? null,
  }));
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
