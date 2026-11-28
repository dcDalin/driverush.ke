/**
 * The school dashboard's loader and action as each person: the owner sees
 * every branch, a branch admin only theirs, another school's owner nothing;
 * actions validate, check the honeypot, and leave the database's guard the
 * last word.
 */
import { beforeAll, describe, expect, it } from "vitest";

import { action, loader } from "~/routes/layouts/school-layout";

import { seededBranchId, serviceClient } from "../db/helpers";
import {
  flashOf,
  getRequest,
  postRequest,
  remixFields,
  routeArgs,
  run,
  signInCookies,
} from "./harness";

let schoolId = "";
let cbd = "";
let westlands = "";
const cookies: Record<string, string> = {};

beforeAll(async () => {
  const heltz = await serviceClient()
    .from("schools")
    .select("id")
    .eq("slug", "heltz")
    .single();
  schoolId = heltz.data!.id;
  cbd = await seededBranchId("heltz", "Nairobi CBD");
  westlands = await seededBranchId("heltz", "Westlands");
  for (const email of [
    "owner@heltz.test",
    "westlands.admin@heltz.test",
    "owner@topgear.test",
  ]) {
    cookies[email] = await signInCookies(email);
  }
});

const path = () => `/school/${schoolId}`;
const load = (cookie?: string) =>
  run(() =>
    loader(
      routeArgs({
        request: getRequest(path(), cookie),
        params: { schoolId },
      }),
    ),
  );
const post = (fields: Record<string, string>, cookie?: string) =>
  run(() =>
    action(
      routeArgs({
        request: postRequest(path(), fields, cookie),
        params: { schoolId },
      }),
    ),
  );

describe("school dashboard loader", () => {
  it("tells a signed-out visitor to sign in", async () => {
    expect((await load()).data.state).toBe("signed-out");
  });

  it("shows the owner every branch's students and the team", async () => {
    const { data } = await load(cookies["owner@heltz.test"]);
    expect(data.state).toBe("ok");
    expect(data.role).toBe("owner");
    expect(data.canManage).toBe(true);
    expect(
      new Set(data.students.map((s: { branchId: string }) => s.branchId)),
    ).toEqual(new Set([cbd, westlands]));
  });

  it("shows a branch admin only their branch, and no team", async () => {
    const { data } = await load(cookies["westlands.admin@heltz.test"]);
    expect(data.role).toBe("admin");
    expect(data.canManage).toBe(false);
    expect(data.invites).toEqual([]);
    expect(
      data.students.every(
        (s: { branchId: string }) => s.branchId === westlands,
      ),
    ).toBe(true);
  });

  it("turns another school's owner away", async () => {
    expect((await load(cookies["owner@topgear.test"])).data.state).toBe(
      "not-member",
    );
  });

  it("sends DriveRush staff to the console, and refuses them students", async () => {
    const staff = await signInCookies("admin@driverush.test");
    const { data } = await load(staff);
    expect(data.state).toBe("staff");
    expect(data.schoolId).toBe(schoolId);
    expect(data.students).toBeUndefined();
    // Students are the school's: staff are refused before anything is read.
    const refused = await post(
      remixFields({
        intent: "release-student",
        linkId: crypto.randomUUID(),
      }),
      staff,
    );
    expect(refused.status).toBe(403);
  });
});

describe("school dashboard action", () => {
  it("refuses a signed-out post", async () => {
    expect(
      (await post({ intent: "release-student", linkId: crypto.randomUUID() }))
        .status,
    ).toBe(401);
  });

  it("refuses a post without the honeypot field", async () => {
    const request = new Request(`http://localhost${path()}`, {
      method: "POST",
      body: (() => {
        const f = new FormData();
        for (const [k, v] of Object.entries(
          remixFields({
            intent: "add-student",
            email: "x@y.co",
            branchId: cbd,
          }),
        ))
          f.set(k, v);
        return f;
      })(),
      headers: { Cookie: cookies["owner@heltz.test"]! },
    });
    const result = await run(() =>
      action(routeArgs({ request, params: { schoolId } })),
    );
    expect(result.status).toBe(400);
  });

  it("returns field errors from the same schema the browser uses", async () => {
    const { data } = await post(
      remixFields({
        intent: "add-student",
        email: "not-an-email",
        branchId: cbd,
      }),
      cookies["owner@heltz.test"],
    );
    expect(data.ok).toBe(false);
    expect(data.errors.email.message).toMatch(/full email address/);
  });

  it("lets a branch admin add a student to their branch", async () => {
    const email = `route-${crypto.randomUUID().slice(0, 8)}@routes.test`;
    const result = await post(
      remixFields({ intent: "add-student", email, branchId: westlands }),
      cookies["westlands.admin@heltz.test"],
    );
    expect(result.data.ok).toBe(true);
    expect(await flashOf(result.headers)).toMatch(/Student added/);
  });

  it("leaves the database's guard the last word on another branch", async () => {
    const result = await post(
      remixFields({
        intent: "add-student",
        email: "nope@routes.test",
        branchId: cbd,
      }),
      cookies["westlands.admin@heltz.test"],
    );
    expect(result.data.ok).toBe(false);
    expect(await flashOf(result.headers)).toMatch(/cannot do that here/);
  });
});
