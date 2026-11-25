/**
 * The database through the real API, as the app will use it: Supabase Auth
 * sign-in (password and emailed code), the access token hook, a school linking
 * a learner by email, branch-scoped progress, and a forged token refused.
 * Needs the local stack with the demo seed (`npm run db:reset`).
 */
import { afterAll, describe, expect, it } from "vitest";

import {
  anonClient,
  claimsOf,
  forgedJwt,
  local,
  seededBranchId,
  serviceClient,
  signInWithEmailCode,
  signInWithPassword,
  uniqueEmail,
} from "./helpers";

const created: string[] = [];

afterAll(async () => {
  const admin = serviceClient().auth.admin;
  for (const email of created) {
    const { data } = await serviceClient()
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();
    if (data) await admin.deleteUser(data.id);
  }
});

describe("the access token", () => {
  it("carries a DriveRush admin role on a password session", async () => {
    const staff = await signInWithPassword("admin@driverush.test");
    expect((await claimsOf(staff)).user_role).toBe("driverush_admin");
  });

  it("carries only `user` when the same admin signs in with an emailed code", async () => {
    const staff = await signInWithEmailCode("admin@driverush.test");
    expect((await claimsOf(staff)).user_role).toBe("user");
    const { error } = await staff.rpc("admin_create_school", {
      p_name: "Code Session School",
      p_slug: "code-session-school",
      p_sponsor_id: "",
      p_owner_email: "nobody@vitest.test",
    });
    expect(error?.code).toBe("42501");
  });

  it("refuses a token signed with the wrong secret", async () => {
    const { url, publishableKey } = local();
    const token = forgedJwt({
      sub: crypto.randomUUID(),
      role: "authenticated",
      user_role: "driverush_su",
    });
    const res = await fetch(`${url}/rest/v1/rpc/my_entitlement`, {
      method: "POST",
      headers: {
        apikey: publishableKey,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: "{}",
    });
    expect(res.status).toBe(401);
  });
});

describe("a school links a learner by email", () => {
  const email = uniqueEmail("learner");
  created.push(email);

  it("waits while the email has no account", async () => {
    const owner = await signInWithPassword("owner@heltz.test");
    const { data: linkId, error } = await owner.rpc("school_add_student", {
      p_branch_id: await seededBranchId("heltz", "Nairobi CBD"),
      p_email: email,
    });
    expect(error).toBeNull();
    const { data: link } = await owner
      .from("school_student_links")
      .select("status")
      .eq("id", linkId!)
      .single();
    expect(link?.status).toBe("pending");
  });

  it("starts when the learner signs up with an emailed code", async () => {
    const learner = await signInWithEmailCode(email);
    const { data, error } = await learner.rpc("my_entitlement");
    expect(error).toBeNull();
    expect(data?.[0]).toMatchObject({
      tier: "school",
      sponsor_id: "heltz",
      pending_invites: 0,
    });
  });

  it("lets the learner save progress, and only their branch's admin read it", async () => {
    const learner = await signInWithEmailCode(email);
    const { data: me } = await learner.auth.getUser();
    const { error } = await learner.from("learner_progress").upsert({
      user_id: me.user!.id,
      store: "board",
      data: { finished: 4 },
      version: 1,
    });
    expect(error).toBeNull();

    const heltz = await serviceClient()
      .from("schools")
      .select("id")
      .eq("slug", "heltz")
      .single();
    const schoolId = heltz.data!.id;

    const cbdAdmin = await signInWithPassword("cbd.admin@heltz.test");
    const cbd = await cbdAdmin.rpc("school_student_progress", {
      p_school_id: schoolId,
    });
    expect(cbd.error).toBeNull();
    expect(
      cbd.data?.find((row) => row.email === email)?.progress,
    ).toMatchObject({ board: { finished: 4 } });

    const westlandsAdmin = await signInWithPassword(
      "westlands.admin@heltz.test",
    );
    const westlands = await westlandsAdmin.rpc("school_student_progress", {
      p_school_id: schoolId,
    });
    expect(westlands.data?.some((row) => row.email === email)).toBe(false);

    const otherOwner = await signInWithPassword("owner@topgear.test");
    const other = await otherOwner.rpc("school_student_progress", {
      p_school_id: schoolId,
    });
    expect(other.error?.code).toBe("42501");
  });
});

describe("a guest", () => {
  it("cannot ask for an entitlement or read schools", async () => {
    const guest = anonClient();
    expect((await guest.rpc("my_entitlement")).error).not.toBeNull();
    expect((await guest.from("schools").select("id")).error?.code).toBe(
      "42501",
    );
  });

  it("can read the plans (none active yet)", async () => {
    const { data, error } = await anonClient().from("plans").select("code");
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });
});
