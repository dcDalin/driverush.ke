/**
 * A school end to end through the routes (owner, 2026-11-26), on a fresh
 * school and fresh accounts so the seeded demo stays as it is:
 *
 *   staff create it in set-up and hand it over (the owner is emailed),
 *   the owner adds a branch and an admin (emailed), the admin adds a student
 *   (emailed) and may not send the bank, the owner sends the bank (Paystack
 *   makes a subaccount; it waits), staff approve it (the owner is emailed),
 *   the school takes payments, the owner sets a price above the old ceiling
 *   but not below the minimum, and changing the owner can keep the old one
 *   on as an admin.
 *
 * Paystack and the email API are stubs; Supabase is the real local stack.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import {
  action as schoolAction,
  loader as schoolLoader,
} from "~/routes/console/school";
import { action as consoleAction } from "~/routes/console/schools";
import {
  action as dashboardAction,
  loader as dashboardLoader,
} from "~/routes/layouts/school-layout";

import { serviceClient } from "../db/helpers";
import {
  flashOf,
  getRequest,
  makeAccount,
  postRequest,
  remixFields,
  run,
  signInCookies,
} from "./harness";

process.env.PAYSTACK_SECRET_KEY = "sk_test_journey123";
process.env.MAILPIT_URL = "http://mailpit.stub";
delete process.env.RESEND_API_KEY;
process.env.STAFF_ALERT_EMAIL = "alerts@driverush.test";

const realFetch = globalThis.fetch;
const emails: { to: string; subject: string }[] = [];
const switchedOff: string[] = [];
let made = 0;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

beforeAll(() => {
  vi.stubGlobal(
    "fetch",
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input instanceof Request ? input.url : input);
      if (url.startsWith("http://mailpit.stub")) {
        const body = JSON.parse(String(init?.body)) as {
          To: { Email: string }[];
          Subject: string;
        };
        emails.push({ to: body.To[0]!.Email, subject: body.Subject });
        return json({ ID: "x" });
      }
      if (!url.startsWith("https://api.paystack.co")) {
        return realFetch(input, init);
      }
      if (url.includes("/bank?")) {
        return json({
          status: true,
          message: "Banks",
          data: [
            { name: "Equity Bank", code: "68", type: "kepss", active: true },
          ],
        });
      }
      if (url.endsWith("/subaccount") && init?.method === "POST") {
        made += 1;
        const body = JSON.parse(String(init.body)) as Record<string, string>;
        return json({
          status: true,
          message: "Subaccount created",
          data: {
            subaccount_code: `ACCT_journey${made}`,
            business_name: body.business_name,
            account_number: body.account_number,
            settlement_bank: "Equity Bank",
          },
        });
      }
      if (url.includes("/subaccount/") && init?.method === "PUT") {
        switchedOff.push(decodeURIComponent(url.split("/subaccount/")[1]!));
        return json({ status: true, message: "Updated", data: {} });
      }
      return json({ status: false, message: "Not stubbed" }, 404);
    },
  );
});

afterAll(() => {
  vi.unstubAllGlobals();
});

const sent = (to: string) => emails.filter((e) => e.to === to);

describe("a school end to end", () => {
  const slug = `journey-${crypto.randomUUID().slice(0, 6)}`;
  let schoolId = "";
  let owner = { email: "", id: "" };
  let staffCookie = "";
  let ownerCookie = "";

  const asSchool = (cookie: string, fields: Record<string, unknown>) =>
    run(() =>
      dashboardAction({
        request: postRequest(
          `/school/${schoolId}`,
          remixFields(fields),
          cookie,
        ),
        params: { schoolId },
        context: {},
      } as never),
    );
  const loadSchool = (cookie: string) =>
    run(() =>
      dashboardLoader({
        request: getRequest(`/school/${schoolId}`, cookie),
        params: { schoolId },
        context: {},
      } as never),
    );
  const asStaff = (fields: Record<string, unknown>) =>
    run(() =>
      schoolAction({
        request: postRequest(
          `/console/schools/${schoolId}`,
          remixFields(fields),
          staffCookie,
        ),
        params: { schoolId },
        context: {},
      } as never),
    );
  const loadStaff = () =>
    run(() =>
      schoolLoader({
        request: getRequest(`/console/schools/${schoolId}`, staffCookie),
        params: { schoolId },
        context: {},
      } as never),
    );

  it("staff set a school up, then hand it over; the owner is emailed", async () => {
    staffCookie = await signInCookies("admin@driverush.test");
    owner = await makeAccount("journey-owner");
    ownerCookie = await signInCookies(owner.email);
    const created = await run(() =>
      consoleAction({
        request: postRequest(
          "/console",
          remixFields({
            intent: "create-school",
            name: "Journey Driving School",
            slug,
            ownerEmail: "",
          }),
          staffCookie,
        ),
        params: {},
        context: {},
      } as never),
    );
    schoolId = created.headers.get("location")!.split("/").pop()!;
    const handed = await asStaff({
      intent: "hand-over",
      schoolId,
      email: owner.email,
      keepPrevious: false,
    });
    expect(handed.data.ok).toBe(true);
    expect(sent(owner.email).map((e) => e.subject)).toEqual([
      "You now run Journey Driving School on DriveRush",
    ]);
    expect((await loadStaff()).data.school.setup.payments).toBe("none");
  });

  let admin = { email: "", id: "" };
  let branchId = "";

  it("the owner adds a branch and an admin; the admin is emailed", async () => {
    await asSchool(ownerCookie, {
      intent: "add-branch",
      name: "Thika Road",
      town: "Nairobi",
    });
    branchId = (await loadSchool(ownerCookie)).data.branches[0].id;
    admin = await makeAccount("journey-admin");
    const added = await asSchool(ownerCookie, {
      intent: "add-admin",
      email: admin.email,
      branchIds: [branchId],
    });
    expect(added.data.ok).toBe(true);
    expect(sent(admin.email)[0]?.subject).toBe(
      "You are an admin of Journey Driving School on DriveRush",
    );
  });

  it("the admin adds a student, who is emailed; it goes again, but not too soon", async () => {
    const adminCookie = await signInCookies(admin.email);
    const student = `journey-student-${crypto.randomUUID().slice(0, 6)}@routes.test`;
    const added = await asSchool(adminCookie, {
      intent: "add-student",
      email: student,
      branchId,
    });
    expect(added.data.ok).toBe(true);
    expect(sent(student)).toHaveLength(1);
    const linkId = (await loadSchool(adminCookie)).data.students[0].id;
    // An inline action: plain values, as useInlineAction posts them.
    const resend = () =>
      run(() =>
        dashboardAction({
          request: postRequest(
            `/school/${schoolId}`,
            { intent: "resend-student", linkId },
            adminCookie,
          ),
          params: { schoolId },
          context: {},
        } as never),
      );

    // At once: refused, and nothing is sent.
    const tooSoon = await resend();
    expect(tooSoon.data.ok).toBe(false);
    expect(await flashOf(tooSoon.headers)).toMatch(/Wait 10 minutes/);
    expect(sent(student)).toHaveLength(1);

    // Ten minutes later (and lapsed): sent, renewed for 30 days.
    await serviceClient()
      .from("school_student_links")
      .update({
        last_sent_at: new Date(Date.now() - 11 * 60_000).toISOString(),
        expires_at: new Date(Date.now() - 1000).toISOString(),
      })
      .eq("id", linkId);
    expect((await loadSchool(adminCookie)).data.students[0].inviteExpired).toBe(
      true,
    );
    const again = await resend();
    expect(again.data.ok).toBe(true);
    expect(sent(student)).toHaveLength(2);
    const row = (await loadSchool(adminCookie)).data.students[0];
    expect(row.inviteExpired).toBe(false);
    expect(row.sentCount).toBe(2);
  });

  it("an admin may not send the school's bank", async () => {
    const adminCookie = await signInCookies(admin.email);
    const refused = await asSchool(adminCookie, {
      intent: "request-bank",
      bankCode: "68",
      accountNumber: "0123456789",
      accountName: "Journey Driving School Ltd",
    });
    expect(refused.status).toBe(403);
  });

  it("the owner sends the bank; it waits, and staff are told", async () => {
    const asked = await asSchool(ownerCookie, {
      intent: "request-bank",
      bankCode: "68",
      accountNumber: "0123456789",
      accountName: "Journey Driving School Ltd",
    });
    expect(asked.data.ok).toBe(true);
    const info = (await loadSchool(ownerCookie)).data.passInfo;
    expect(info.ready).toBe(false);
    expect(info.pending_bank_label).toBe("Equity Bank ••6789");
    expect(sent("alerts@driverush.test").at(-1)?.subject).toBe(
      "Bank to check: Journey Driving School",
    );
    expect((await loadStaff()).data.school.setup.payments).toBe("waiting");
  });

  it("staff approve it: the school takes payments and the owner is emailed", async () => {
    const approved = await asStaff({
      intent: "review-bank",
      schoolId,
      decision: "approve",
      note: "",
    });
    expect(approved.data.ok).toBe(true);
    const info = (await loadSchool(ownerCookie)).data.passInfo;
    expect(info.ready).toBe(true);
    expect(info.bank_label).toBe("Equity Bank ••6789");
    expect(sent(owner.email).at(-1)?.subject).toBe(
      "Journey Driving School can take payments now",
    );
  });

  it("a new bank waits while the old one is paid; turning it down switches it off", async () => {
    await asSchool(ownerCookie, {
      intent: "request-bank",
      bankCode: "68",
      accountNumber: "9876543210",
      accountName: "Journey Driving School Ltd",
    });
    expect((await loadSchool(ownerCookie)).data.passInfo.bank_label).toBe(
      "Equity Bank ••6789",
    );
    const declined = await asStaff({
      intent: "review-bank",
      schoolId,
      decision: "decline",
      note: "The account name does not match the letter.",
    });
    expect(declined.data.ok).toBe(true);
    expect(switchedOff).toContain(`ACCT_journey${made}`);
    const info = (await loadSchool(ownerCookie)).data.passInfo;
    expect(info.review_note).toBe(
      "The account name does not match the letter.",
    );
    expect(info.bank_label).toBe("Equity Bank ••6789");
  });

  it("the owner sets any price at or above the minimum, with no ceiling", async () => {
    const low = await asSchool(ownerCookie, {
      intent: "set-pass-price",
      priceKes: 349,
    });
    expect(low.data.ok).toBe(false);
    const high = await asSchool(ownerCookie, {
      intent: "set-pass-price",
      priceKes: 1500,
    });
    expect(high.data.ok).toBe(true);
    expect((await loadSchool(ownerCookie)).data.passInfo.price_kes).toBe(1500);
  });

  it("changing the owner can keep the old one on as an admin", async () => {
    const next = await makeAccount("journey-next");
    const changed = await asStaff({
      intent: "hand-over",
      schoolId,
      email: next.email,
      keepPrevious: true,
    });
    expect(changed.data.ok).toBe(true);
    const { data } = await serviceClient()
      .from("school_members")
      .select("user_id, role")
      .eq("school_id", schoolId);
    expect(data).toEqual(
      expect.arrayContaining([
        { user_id: next.id, role: "owner" },
        { user_id: owner.id, role: "admin" },
      ]),
    );
  });
});
