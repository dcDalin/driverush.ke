/**
 * Buying a pass through the routes, with Paystack answered by a stub (every
 * other request, Supabase's included, goes through): /pass starts the
 * payment and sends the learner to Paystack with the school's split, the
 * webhook only believes a signed event and asks Paystack again, settling is
 * once only, the return page reads the outcome, and a refund stops the pass.
 * Fresh accounts only, so the seeded personas stay as the other suites
 * expect them.
 */
import { createHmac } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { action as webhook } from "~/routes/api/webhooks.paystack";
import { action as passAction, loader as passLoader } from "~/routes/pass";
import { loader as doneLoader } from "~/routes/pass-done";

import { seededBranchId, serviceClient } from "../db/helpers";
import {
  getRequest,
  makeAccount,
  postRequest,
  remixFields,
  run,
  signInCookies,
} from "./harness";

const SECRET = "sk_test_routes123";
process.env.PAYSTACK_SECRET_KEY = SECRET;

/** What the stub says when asked to verify a reference. */
const verdicts = new Map<string, { status: string; amount: number }>();
const initialized: Record<string, unknown>[] = [];
const realFetch = globalThis.fetch;

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
      if (!url.startsWith("https://api.paystack.co")) {
        return realFetch(input, init);
      }
      if (url.endsWith("/transaction/initialize")) {
        const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
        initialized.push(body);
        return json({
          status: true,
          message: "Authorization URL created",
          data: {
            authorization_url: `https://checkout.paystack.com/${String(body.reference)}`,
            access_code: "test",
            reference: body.reference,
          },
        });
      }
      const ref = decodeURIComponent(
        url.split("/transaction/verify/")[1] ?? "",
      );
      const verdict = verdicts.get(ref);
      if (!verdict) {
        return json(
          { status: false, message: "Transaction reference not found" },
          400,
        );
      }
      return json({
        status: true,
        message: "Verification successful",
        data: {
          reference: ref,
          status: verdict.status,
          amount: verdict.amount,
          currency: "KES",
          fees: 1050,
          channel: "mobile_money",
        },
      });
    },
  );
});

afterAll(() => {
  vi.unstubAllGlobals();
});

const signed = (body: string, key = SECRET) =>
  new Request("http://localhost/api/webhooks/paystack", {
    method: "POST",
    body,
    headers: {
      "Content-Type": "application/json",
      "x-paystack-signature": createHmac("sha512", key)
        .update(body)
        .digest("hex"),
    },
  });

async function payment(reference: string) {
  const { data } = await serviceClient()
    .from("payments")
    .select("status, amount_kes, school_share_kes, payer_user_id")
    .eq("provider_ref", reference)
    .single();
  return data!;
}

async function passes(userId: string) {
  const { data } = await serviceClient()
    .from("learner_subscriptions")
    .select("id, status, starts_at, ends_at")
    .eq("user_id", userId);
  return data ?? [];
}

async function buy(cookie: string, fields: Record<string, unknown>) {
  return run(() =>
    passAction({
      request: postRequest(
        "/pass",
        remixFields({ intent: "buy", level: "", ...fields }),
        cookie,
      ),
      params: {},
      context: {},
    } as never),
  );
}

const referenceFrom = (location: string | null) =>
  location?.replace("https://checkout.paystack.com/", "") ?? "";

describe("/pass", () => {
  it("asks a guest to sign in", async () => {
    const out = await run(() =>
      passLoader({
        request: getRequest("/pass"),
        params: {},
        context: {},
      } as never),
    );
    expect(out.data.state).toBe("signed-out");
  });

  it("offers a linked learner their own school, and shows the pass they have", async () => {
    // Amina: linked to Heltz, paid KES 700 through it (local_demo.sql).
    const cookie = await signInCookies("amina@learner.test");
    const out = await run(() =>
      passLoader({
        request: getRequest("/pass", cookie),
        params: {},
        context: {},
      } as never),
    );
    expect(out.data.state).toBe("ok");
    expect(out.data.offers).toEqual([
      expect.objectContaining({ code: "HELTZ", price_kes: 700, linked: true }),
    ]);
    expect(out.data.passEndsAt).not.toBeNull();
    expect(out.data.more).toMatchObject({ price_kes: 300, days: 30 });
  });

  it("finds a school by the code it hands out", async () => {
    const { email } = await makeAccount("code");
    const cookie = await signInCookies(email);
    const out = await run(() =>
      passLoader({
        request: getRequest("/pass?code=heltz", cookie),
        params: {},
        context: {},
      } as never),
    );
    expect(out.data.codeOffer).toMatchObject({
      school_name: "Heltz Driving School",
      price_kes: 700,
    });
    expect(out.data.more).toBeUndefined();
  });
});

describe("paying, the webhook and the return page", () => {
  let learner = { email: "", id: "" };
  let cookie = "";
  let schoolRef = "";
  let ownRef = "";

  beforeAll(async () => {
    learner = await makeAccount("payer");
    cookie = await signInCookies(learner.email);
  });

  it("sends a school pass to Paystack with the school's subaccount and DriveRush's KES 300", async () => {
    const cbd = await seededBranchId("heltz", "Nairobi CBD");
    const out = await buy(cookie, {
      plan: "school_pass",
      schoolCode: "HELTZ",
      branchId: cbd,
    });
    expect(out.status).toBe(302);
    schoolRef = referenceFrom(out.headers.get("location"));
    expect(schoolRef).toMatch(/^dr_/);
    expect(initialized.at(-1)).toMatchObject({
      reference: schoolRef,
      amount: 70000,
      currency: "KES",
      subaccount: "ACCT_local_heltz",
      transaction_charge: 30000,
      bearer: "account",
      email: learner.email,
    });
    expect(await payment(schoolRef)).toMatchObject({
      status: "pending",
      school_share_kes: 400,
    });
  });

  it("refuses a webhook Paystack did not sign", async () => {
    const body = JSON.stringify({
      event: "charge.success",
      data: { reference: schoolRef },
    });
    const out = await run(() =>
      webhook({
        request: signed(body, "sk_test_wrong"),
        params: {},
        context: {},
      } as never),
    );
    expect(out.status).toBe(401);
    expect((await payment(schoolRef)).status).toBe("pending");
  });

  it("settles once on a signed charge.success, after asking Paystack", async () => {
    verdicts.set(schoolRef, { status: "success", amount: 70000 });
    const body = JSON.stringify({
      event: "charge.success",
      data: { reference: schoolRef, amount: 1 },
    });
    for (let i = 0; i < 2; i++) {
      const out = await run(() =>
        webhook({ request: signed(body), params: {}, context: {} } as never),
      );
      expect(out.status).toBe(200);
    }
    expect((await payment(schoolRef)).status).toBe("succeeded");
    expect(await passes(learner.id)).toHaveLength(1);
  });

  it("tells the learner on the return page", async () => {
    const out = await run(() =>
      doneLoader({
        request: getRequest(
          `/pass/done?reference=${schoolRef}&level=drive-straight`,
          cookie,
        ),
        params: {},
        context: {},
      } as never),
    );
    expect(out.data).toMatchObject({ state: "paid", back: "drive-straight" });
    expect(out.data.passEndsAt).not.toBeNull();
  });

  it("says a payment the learner gave up on did not go through", async () => {
    const out = await buy(cookie, { plan: "learner_pass" });
    ownRef = referenceFrom(out.headers.get("location"));
    expect(initialized.at(-1)).toMatchObject({ amount: 100000 });
    expect(initialized.at(-1)).not.toHaveProperty("subaccount");
    verdicts.set(ownRef, { status: "abandoned", amount: 100000 });
    const done = await run(() =>
      doneLoader({
        request: getRequest(`/pass/done?reference=${ownRef}`, cookie),
        params: {},
        context: {},
      } as never),
    );
    expect(done.data.state).toBe("failed");
    expect((await payment(ownRef)).status).toBe("failed");
  });

  it("shows nobody else's payment", async () => {
    const other = await signInCookies("esther@learner.test");
    const out = await run(() =>
      doneLoader({
        request: getRequest(`/pass/done?reference=${schoolRef}`, other),
        params: {},
        context: {},
      } as never),
    );
    expect(out.data.state).toBe("missing");
  });

  it("stops the pass when Paystack reports a refund", async () => {
    const body = JSON.stringify({
      event: "refund.processed",
      data: { status: "processed", transaction_reference: schoolRef },
    });
    const out = await run(() =>
      webhook({ request: signed(body), params: {}, context: {} } as never),
    );
    expect(out.status).toBe(200);
    expect((await payment(schoolRef)).status).toBe("refunded");
    expect((await passes(learner.id))[0]?.status).toBe("cancelled");
  });

  it("ignores events about payments that are not ours", async () => {
    const body = JSON.stringify({
      event: "charge.success",
      data: { reference: "T123456" },
    });
    const out = await run(() =>
      webhook({ request: signed(body), params: {}, context: {} } as never),
    );
    expect(out.status).toBe(200);
  });
});
