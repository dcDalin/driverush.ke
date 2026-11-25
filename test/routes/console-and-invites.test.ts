/**
 * The console (staff only) and the account menu's invites resource route.
 */
import { describe, expect, it } from "vitest";

import {
  action as invitesAction,
  loader as invitesLoader,
} from "~/routes/api/me.school-invites";
import {
  action as consoleAction,
  loader as consoleLoader,
} from "~/routes/console";

import { seededBranchId } from "../db/helpers";
import {
  freshEmail,
  getRequest,
  makeAccount,
  postRequest,
  remixFields,
  run,
  signInCookies,
} from "./harness";

const args = (request: Request) =>
  ({ request, params: {}, context: {} }) as never;

describe("console", () => {
  it("shows a learner the staff-only page and refuses their posts", async () => {
    const cookie = await signInCookies("amina@learner.test");
    expect(
      (await run(() => consoleLoader(args(getRequest("/console", cookie)))))
        .data.state,
    ).toBe("not-staff");
    const refused = await run(() =>
      consoleAction(
        args(
          postRequest(
            "/console",
            {
              intent: "set-status",
              schoolId: crypto.randomUUID(),
              status: "active",
            },
            cookie,
          ),
        ),
      ),
    );
    expect(refused.status).toBe(403);
  });

  it("lets staff create a school for an owner who has not signed up", async () => {
    const cookie = await signInCookies("admin@driverush.test");
    const slug = `route-${crypto.randomUUID().slice(0, 6)}`;
    const created = await run(() =>
      consoleAction(
        args(
          postRequest(
            "/console",
            remixFields({
              intent: "create-school",
              name: "Route Test School",
              slug,
              ownerEmail: `${slug}@routes.test`,
            }),
            cookie,
          ),
        ),
      ),
    );
    expect(created.data.ok).toBe(true);
    const { data } = await run(() =>
      consoleLoader(args(getRequest("/console", cookie))),
    );
    expect(
      data.schools.find((s: { slug: string }) => s.slug === slug)?.ownerEmail,
    ).toBeNull();
  });
});

describe("school invites resource route", () => {
  it("lists two waiting schools and joins one", async () => {
    // The account comes after both adds: with two schools waiting, neither starts.
    const email = freshEmail("invited");
    const owner = await signInCookies("owner@heltz.test");
    const topgearOwner = await signInCookies("owner@topgear.test");
    const { action: dashboardAction } =
      await import("~/routes/school-dashboard");
    const { serviceClient } = await import("../db/helpers");
    const schools = await serviceClient().from("schools").select("id, slug");
    const idOf = (slug: string) =>
      schools.data!.find((s) => s.slug === slug)!.id;

    for (const [slug, cookie, branch] of [
      ["heltz", owner, await seededBranchId("heltz", "Nairobi CBD")],
      ["topgear", topgearOwner, await seededBranchId("topgear", "Thika Road")],
    ] as const) {
      const added = await run(() =>
        dashboardAction({
          request: postRequest(
            `/school/${idOf(slug)}`,
            remixFields({
              intent: "add-student",
              email,
              branchId: branch,
            }),
            cookie,
          ),
          params: { schoolId: idOf(slug) },
          context: {},
        } as never),
      );
      expect(added.data.ok).toBe(true);
    }

    await makeAccount("invited", email);
    const cookie = await signInCookies(email);
    const listed = await run(() =>
      invitesLoader(args(getRequest("/api/me/school-invites", cookie))),
    );
    expect(listed.data.invites).toHaveLength(2);

    const joined = await run(() =>
      invitesAction(
        args(
          postRequest(
            "/api/me/school-invites",
            { intent: "join", linkId: listed.data.invites[0].id },
            cookie,
          ),
        ),
      ),
    );
    expect(joined.data).toEqual({
      ok: true,
      message: "You are now with this school for a month.",
    });
    const after = await run(() =>
      invitesLoader(args(getRequest("/api/me/school-invites", cookie))),
    );
    expect(after.data.invites).toHaveLength(1);
  });

  it("refuses a signed-out visitor", async () => {
    expect(
      (
        await run(() =>
          invitesLoader(args(getRequest("/api/me/school-invites"))),
        )
      ).status,
    ).toBe(401);
  });
});
