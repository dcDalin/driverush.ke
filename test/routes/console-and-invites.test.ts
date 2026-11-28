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
} from "~/routes/console/schools";
import { loader as frameLoader } from "~/routes/layouts/console-layout";

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
      (await run(() => frameLoader(args(getRequest("/console", cookie))))).data
        .state,
    ).toBe("not-staff");
    // The page under the frame gives a non-staff caller nothing either.
    expect(
      (
        await run(() =>
          consoleLoader(args(getRequest("/console/schools", cookie))),
        )
      ).data,
    ).toEqual({ gated: true });
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
    // Straight to the new school's page.
    expect(created.status).toBe(302);
    expect(created.headers.get("location")).toMatch(
      /^\/console\/schools\/[0-9a-f-]{36}$/,
    );
    const { data } = await run(() =>
      consoleLoader(args(getRequest(`/console/schools?q=${slug}`, cookie))),
    );
    const row = data.schools.find((s: { slug: string }) => s.slug === slug);
    expect(row?.status).toBe("active");
    expect(row?.owner_email).toBeNull();
    expect(row?.invited_owner_email).toBe(`${slug}@routes.test`);
  });

  it("creates a school in set-up without an owner, and hands it over", async () => {
    const cookie = await signInCookies("admin@driverush.test");
    const slug = `route-setup-${crypto.randomUUID().slice(0, 6)}`;
    const created = await run(() =>
      consoleAction(
        args(
          postRequest(
            "/console",
            remixFields({
              intent: "create-school",
              name: "Route Setup",
              slug,
              ownerEmail: "",
            }),
            cookie,
          ),
        ),
      ),
    );
    const schoolId = created.headers.get("location")!.split("/").pop()!;
    const { loader: schoolLoader, action: schoolAction } =
      await import("~/routes/console/school");
    const load = () =>
      run(() =>
        schoolLoader({
          request: getRequest(`/console/schools/${schoolId}`, cookie),
          params: { schoolId },
          context: {},
        } as never),
      );
    expect((await load()).data.school.school.status).toBe("setup");
    const handed = await run(() =>
      schoolAction({
        request: postRequest(
          `/console/schools/${schoolId}`,
          remixFields({
            intent: "hand-over",
            schoolId,
            email: `${slug}@routes.test`,
          }),
          cookie,
        ),
        params: { schoolId },
        context: {},
      } as never),
    );
    expect(handed.data.ok).toBe(true);
    const after = (await load()).data.school;
    expect(after.school.status).toBe("active");
    expect(after.invitedOwnerEmail).toBe(`${slug}@routes.test`);
  });

  it("refuses the school page's changes to a school owner", async () => {
    const cookie = await signInCookies("owner@heltz.test");
    const { action: schoolAction } = await import("~/routes/console/school");
    const refused = await run(() =>
      schoolAction({
        request: postRequest(
          "/console/schools/x",
          remixFields({
            intent: "hand-over",
            schoolId: crypto.randomUUID(),
            email: "x@routes.test",
          }),
          cookie,
        ),
        params: { schoolId: "x" },
        context: {},
      } as never),
    );
    expect(refused.status).toBe(403);
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
