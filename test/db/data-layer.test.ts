/**
 * The app/database functions against the real local stack, each called as a
 * real signed-in person: what every role reads, what it may change, and the
 * plain sentence a refused change comes back with. Seeded people (see
 * supabase/seeds/local_demo.sql) are only read; anything a test changes is
 * made fresh for it.
 */
import { describe, expect, it } from "vitest";

import * as consoleDb from "~/database/console/mutations";
import { getConsoleOverview } from "~/database/console/queries";
import { getMyEntitlement } from "~/database/entitlement/get-my-entitlement";
import {
  acceptSchoolInvite,
  declineSchoolInvite,
  listMySchoolInvites,
} from "~/database/learner/school-invites";
import { listMyProgress, upsertMyProgress } from "~/database/progress/progress";
import { getSchoolDashboard } from "~/database/schools/dashboard";
import * as schools from "~/database/schools/mutations";
import { listMySchools } from "~/database/schools/queries";

import {
  anonClient,
  makeAccount,
  schoolIdBySlug,
  seededBranchId,
  serviceClient,
  signInWithPassword,
  uniqueEmail,
} from "./helpers";

async function userId(email: string) {
  const { data } = await serviceClient()
    .from("profiles")
    .select("id")
    .eq("email", email)
    .single();
  return data!.id;
}

describe("progress", () => {
  it("saves and reads back the learner's own stores", async () => {
    const me = await makeAccount("progress");
    const saved = await upsertMyProgress(me.client, me.id, [
      { store: "streak", data: { json: { days: 2 } }, version: 1 },
      {
        store: "board",
        data: { json: { state: { learned: ["a"] } } },
        version: 1,
      },
    ]);
    expect(saved.error).toBeNull();
    const rows = await listMyProgress(me.client);
    expect(rows.map((r) => r.store).sort()).toEqual(["board", "streak"]);
  });

  it("never writes or reads another learner's rows", async () => {
    const me = await makeAccount("progress-a");
    const other = await makeAccount("progress-b");
    await upsertMyProgress(other.client, other.id, [
      { store: "streak", data: { json: { days: 9 } }, version: 1 },
    ]);
    const refused = await upsertMyProgress(me.client, other.id, [
      { store: "streak", data: { json: { days: 0 } }, version: 1 },
    ]);
    expect(refused.error).toBe("You cannot do that here.");
    expect(await listMyProgress(me.client)).toEqual([]);
  });
});

describe("entitlement", () => {
  it("knows school, paid and free learners", async () => {
    const amina = await getMyEntitlement(
      await signInWithPassword("amina@learner.test"),
    );
    expect(amina).toMatchObject({ tier: "school", sponsor_id: "heltz" });
    const dan = await getMyEntitlement(
      await signInWithPassword("dan@learner.test"),
    );
    expect(dan).toMatchObject({ tier: "paid", sponsor_id: null });
    const esther = await getMyEntitlement(
      await signInWithPassword("esther@learner.test"),
    );
    expect(esther).toMatchObject({ tier: "free", school_id: null });
  });
});

describe("school invites", () => {
  it("lets a learner choose between two schools that added them", async () => {
    const email = uniqueEmail("chooser");
    const heltzOwner = await signInWithPassword("owner@heltz.test");
    const topgearOwner = await signInWithPassword("owner@topgear.test");
    expect(
      (
        await schools.addStudent(
          heltzOwner,
          await seededBranchId("heltz", "Nairobi CBD"),
          email,
        )
      ).error,
    ).toBeNull();
    expect(
      (
        await schools.addStudent(
          topgearOwner,
          await seededBranchId("topgear", "Thika Road"),
          email,
        )
      ).error,
    ).toBeNull();

    const { data } = await serviceClient().auth.admin.createUser({
      email,
      password: "driverush-local-1",
      email_confirm: true,
    });
    const learner = await signInWithPassword(email);
    const invites = await listMySchoolInvites(learner, data.user!.id);
    expect(invites.map((i) => i.school).sort()).toEqual([
      "Heltz Driving School",
      "Top Gear Driving School",
    ]);

    expect(
      (await declineSchoolInvite(learner, invites[0]!.id)).error,
    ).toBeNull();
    expect(
      (await acceptSchoolInvite(learner, invites[1]!.id)).error,
    ).toBeNull();
    expect(await getMyEntitlement(learner)).toMatchObject({ tier: "school" });
    expect((await acceptSchoolInvite(learner, invites[1]!.id)).error).toBe(
      "That has already been answered or started.",
    );
  });
});

describe("school dashboard", () => {
  it("shows the owner every branch and a branch admin only theirs", async () => {
    const schoolId = await schoolIdBySlug("heltz");
    const westlands = await seededBranchId("heltz", "Westlands");

    const owner = await getSchoolDashboard(
      await signInWithPassword("owner@heltz.test"),
      {
        schoolId,
        userId: await userId("owner@heltz.test"),
        role: "user",
      },
    );
    expect(owner?.role).toBe("owner");
    expect(owner?.branches).toHaveLength(2);
    expect(owner?.team.map((m) => m.role).sort()).toEqual([
      "admin",
      "admin",
      "owner",
    ]);

    const admin = await getSchoolDashboard(
      await signInWithPassword("westlands.admin@heltz.test"),
      {
        schoolId,
        userId: await userId("westlands.admin@heltz.test"),
        role: "user",
      },
    );
    expect(admin?.canManage).toBe(false);
    expect(admin?.myBranchIds).toEqual([westlands]);
    expect(admin?.students.every((s) => s.branchId === westlands)).toBe(true);
    expect(admin?.invites).toEqual([]);
  });

  it("is null for someone with no place in the school", async () => {
    const dashboard = await getSchoolDashboard(
      await signInWithPassword("owner@topgear.test"),
      {
        schoolId: await schoolIdBySlug("heltz"),
        userId: await userId("owner@topgear.test"),
        role: "user",
      },
    );
    expect(dashboard).toBeNull();
  });

  it("lists the schools a person works for", async () => {
    const mine = await listMySchools(
      await signInWithPassword("cbd.admin@heltz.test"),
      await userId("cbd.admin@heltz.test"),
    );
    expect(mine.map((s) => [s.name, s.role])).toEqual([
      ["Heltz Driving School", "admin"],
    ]);
  });
});

describe("school changes", () => {
  it("lets a branch admin add a student to their branch, not another", async () => {
    const admin = await signInWithPassword("westlands.admin@heltz.test");
    const ok = await schools.addStudent(
      admin,
      await seededBranchId("heltz", "Westlands"),
      uniqueEmail("w"),
    );
    expect(ok.error).toBeNull();
    expect(typeof ok.data).toBe("string");
    const refused = await schools.addStudent(
      admin,
      await seededBranchId("heltz", "Nairobi CBD"),
      uniqueEmail("c"),
    );
    expect(refused.error).toBe("You cannot do that here.");
  });

  it("refuses another school's branch for an admin, and a second branch of the same name", async () => {
    const owner = await signInWithPassword("owner@heltz.test");
    const heltz = await schoolIdBySlug("heltz");
    const wrong = await schools.addAdmin(owner, heltz, uniqueEmail("admin"), [
      await seededBranchId("topgear", "Thika Road"),
    ]);
    expect(wrong.error).toBe("Pick at least one branch of this school.");
    const duplicate = await schools.createBranch(
      owner,
      heltz,
      "Westlands",
      "Nairobi",
    );
    expect(duplicate.error).toBe("That already exists.");
  });
});

describe("console", () => {
  it("shows a su the staff list and an admin none", async () => {
    const su = await getConsoleOverview(
      await signInWithPassword("su@driverush.test"),
      { su: true },
    );
    // Other tests grant roles to fresh accounts, so check the seeded staff are there.
    expect(su.staff.map((s) => s.email)).toEqual(
      expect.arrayContaining(["admin@driverush.test", "su@driverush.test"]),
    );
    expect(su.schools.find((s) => s.slug === "heltz")?.ownerEmail).toBe(
      "owner@heltz.test",
    );
    const admin = await getConsoleOverview(
      await signInWithPassword("admin@driverush.test"),
      { su: false },
    );
    expect(admin.staff).toEqual([]);
  });

  it("lets staff create a school and refuses a learner", async () => {
    const slug = `db-${crypto.randomUUID().slice(0, 6)}`;
    const school = {
      name: "Data Layer School",
      slug,
      sponsorId: null,
      ownerEmail: `${slug}@vitest.test`,
    };
    const learner = await consoleDb.createSchool(
      await signInWithPassword("esther@learner.test"),
      school,
    );
    expect(learner.error).toBe("You cannot do that here.");
    const staff = await consoleDb.createSchool(
      await signInWithPassword("admin@driverush.test"),
      school,
    );
    expect(staff.error).toBeNull();
    const again = await consoleDb.createSchool(
      await signInWithPassword("admin@driverush.test"),
      school,
    );
    expect(again.error).toBe("That already exists.");
  });

  it("only lets a su grant roles", async () => {
    const target = await makeAccount("role");
    const byAdmin = await consoleDb.grantPlatformRole(
      await signInWithPassword("admin@driverush.test"),
      target.id,
      "driverush_admin",
    );
    expect(byAdmin.error).toBe("You cannot do that here.");
    const bySu = await consoleDb.grantPlatformRole(
      await signInWithPassword("su@driverush.test"),
      target.id,
      "driverush_admin",
    );
    expect(bySu.error).toBeNull();
  });
});

describe("row level security through the API", () => {
  it("shows a guest only active plans and nothing else", async () => {
    const guest = anonClient();
    expect((await guest.from("plans").select("code")).data).toEqual([]);
    for (const table of [
      "schools",
      "profiles",
      "school_student_links",
      "learner_progress",
    ] as const) {
      expect((await guest.from(table).select("*")).error?.code, table).toBe(
        "42501",
      );
    }
  });

  it("shows a learner no school's team or invites", async () => {
    const learner = await signInWithPassword("esther@learner.test");
    expect((await learner.from("school_members").select("id")).data).toEqual(
      [],
    );
    expect(
      (await learner.from("school_member_invites").select("id")).data,
    ).toEqual([]);
    expect(
      (await learner.from("subscription_pauses").select("link_id")).error?.code,
    ).toBe("42501");
  });
});
