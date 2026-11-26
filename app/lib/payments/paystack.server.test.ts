import { createHmac } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import { getPaystackEnv, paymentsEnabled } from "./env.server";
import {
  deactivateSubaccount,
  fromSubunits,
  initializeTransaction,
  listKenyanBanks,
  PaystackError,
  toSubunits,
  verifySignature,
  verifyTransaction,
} from "./paystack.server";

const SECRET = "sk_test_abc123";
const WHSEC = "whsec_xyz789";
const BODY = JSON.stringify({
  event: "charge.success",
  data: { reference: "dr_1" },
});
const NOW = 1_800_000_000;

const sign = (key: string, payload: string) =>
  createHmac("sha512", key).update(payload).digest("hex");

function jsonFetch(body: unknown, status = 200) {
  return vi.fn(
    async (..._args: Parameters<typeof fetch>) =>
      new Response(JSON.stringify(body), { status }),
  );
}

describe("amounts", () => {
  it("turns shillings into subunits and back", () => {
    expect(toSubunits(700)).toBe(70000);
    expect(fromSubunits(1050)).toBe(10.5);
  });
  it("refuses fractions and negatives", () => {
    expect(() => toSubunits(10.5)).toThrow(RangeError);
    expect(() => toSubunits(-1)).toThrow(RangeError);
  });
});

describe("env", () => {
  it("is off without a secret key", () => {
    expect(paymentsEnabled({})).toBe(false);
    expect(() => getPaystackEnv({})).toThrow(/Payments are off/);
  });
  it("knows a live key", () => {
    expect(getPaystackEnv({ PAYSTACK_SECRET_KEY: "sk_live_1" }).live).toBe(
      true,
    );
  });
  it("refuses a public key in the secret's place", () => {
    expect(() =>
      paymentsEnabled({ PAYSTACK_SECRET_KEY: "pk_test_1" }),
    ).toThrow();
  });
});

describe("verifySignature", () => {
  const keys = { secretKey: SECRET, webhookSecret: WHSEC };

  it("accepts the legacy body signature", () => {
    const headers = new Headers({ "x-paystack-signature": sign(SECRET, BODY) });
    expect(verifySignature(BODY, headers, keys, NOW)).toEqual({
      ok: true,
      scheme: "legacy",
    });
  });

  it("accepts a timestamped signature among several", () => {
    const good = sign(WHSEC, `${NOW}.${BODY}`);
    const headers = new Headers({
      "paystack-signature": `t=${NOW},v1=whk_old:${"ab".repeat(64)},v1=whk_new:${good}`,
    });
    expect(verifySignature(BODY, headers, keys, NOW + 10)).toEqual({
      ok: true,
      scheme: "v1",
    });
  });

  it("refuses a tampered body", () => {
    const headers = new Headers({ "x-paystack-signature": sign(SECRET, BODY) });
    expect(verifySignature(`${BODY} `, headers, keys, NOW)).toEqual({
      ok: false,
      reason: "mismatch",
    });
  });

  it("refuses an old timestamped signature", () => {
    const headers = new Headers({
      "paystack-signature": `t=${NOW},v1=whk_1:${sign(WHSEC, `${NOW}.${BODY}`)}`,
    });
    expect(verifySignature(BODY, headers, keys, NOW + 301)).toEqual({
      ok: false,
      reason: "stale",
    });
  });

  it("refuses no signature and a signature from the wrong key", () => {
    expect(verifySignature(BODY, new Headers(), keys, NOW)).toEqual({
      ok: false,
      reason: "missing",
    });
    const headers = new Headers({
      "x-paystack-signature": sign("sk_test_other", BODY),
    });
    expect(verifySignature(BODY, headers, keys, NOW).ok).toBe(false);
  });
});

describe("initializeTransaction", () => {
  const ok = {
    status: true,
    message: "Authorization URL created",
    data: {
      authorization_url: "https://checkout.paystack.com/abc",
      access_code: "abc",
      reference: "dr_1",
    },
  };

  it("sends a school pass with the school's subaccount and DriveRush's flat share", async () => {
    const f = jsonFetch(ok);
    const res = await initializeTransaction(
      SECRET,
      {
        email: "learner@example.test",
        amountKes: 700,
        reference: "dr_1",
        callbackUrl: "https://driverush.ke/pass/done",
        split: { subaccount: "ACCT_heltz", driverushShareKes: 300 },
      },
      f,
    );
    expect(res.authorization_url).toBe("https://checkout.paystack.com/abc");
    const [url, init] = f.mock.calls[0]!;
    expect(url).toBe("https://api.paystack.co/transaction/initialize");
    expect(new Headers(init?.headers).get("authorization")).toBe(
      `Bearer ${SECRET}`,
    );
    expect(JSON.parse(String(init?.body))).toMatchObject({
      amount: 70000,
      currency: "KES",
      subaccount: "ACCT_heltz",
      transaction_charge: 30000,
      bearer: "subaccount",
      channels: ["mobile_money", "card"],
    });
  });

  it("sends a public pass with no split", async () => {
    const f = jsonFetch(ok);
    await initializeTransaction(
      SECRET,
      {
        email: "learner@example.test",
        amountKes: 1000,
        reference: "dr_2",
        callbackUrl: "https://driverush.ke/pass/done",
      },
      f,
    );
    const body = JSON.parse(String(f.mock.calls[0]![1]?.body));
    expect(body.amount).toBe(100000);
    expect(body).not.toHaveProperty("subaccount");
    expect(body).not.toHaveProperty("transaction_charge");
  });

  it("refuses a share that leaves the school nothing", async () => {
    expect(() =>
      initializeTransaction(SECRET, {
        email: "l@example.test",
        amountKes: 300,
        reference: "dr_3",
        callbackUrl: "https://driverush.ke/pass/done",
        split: { subaccount: "ACCT_x", driverushShareKes: 300 },
      }),
    ).toThrow(RangeError);
  });

  it("turns Paystack's refusals into PaystackError", async () => {
    const f = jsonFetch({ status: false, message: "Invalid key" }, 401);
    await expect(
      initializeTransaction(
        SECRET,
        {
          email: "l@example.test",
          amountKes: 1000,
          reference: "dr_4",
          callbackUrl: "https://driverush.ke/pass/done",
        },
        f,
      ),
    ).rejects.toEqual(new PaystackError("Invalid key", 401));
  });
});

describe("verifyTransaction", () => {
  it("reads a successful KES payment in shillings", async () => {
    const f = jsonFetch({
      status: true,
      message: "Verification successful",
      data: {
        reference: "dr_1",
        status: "success",
        amount: 70000,
        currency: "KES",
        fees: 1050,
        channel: "mobile_money",
      },
    });
    const v = await verifyTransaction(SECRET, "dr_1", f);
    expect(v).toMatchObject({
      succeeded: true,
      amountKes: 700,
      feeKes: 10.5,
      channel: "mobile_money",
    });
    expect(f.mock.calls[0]![0]).toBe(
      "https://api.paystack.co/transaction/verify/dr_1",
    );
  });

  it("does not count an abandoned payment", async () => {
    const f = jsonFetch({
      status: true,
      message: "Verification successful",
      data: {
        reference: "dr_1",
        status: "abandoned",
        amount: 70000,
        currency: "KES",
      },
    });
    expect((await verifyTransaction(SECRET, "dr_1", f)).succeeded).toBe(false);
  });
});

describe("listKenyanBanks", () => {
  it("keeps active banks, drops mobile money, sorts by name", async () => {
    const f = jsonFetch({
      status: true,
      message: "Banks retrieved",
      data: [
        {
          name: "Equity Bank Kenya Ltd",
          code: "68",
          type: "kepss",
          active: true,
        },
        { name: "M-PESA", code: "MPESA", type: "mobile_money", active: true },
        { name: "ABSA Bank Kenya", code: "03", type: "kepss", active: true },
        { name: "Closed Bank", code: "99", type: "kepss", active: false },
      ],
    });
    expect(await listKenyanBanks(SECRET, f)).toEqual([
      { name: "ABSA Bank Kenya", code: "03" },
      { name: "Equity Bank Kenya Ltd", code: "68" },
    ]);
  });
});

describe("deactivateSubaccount", () => {
  it("switches the subaccount off with a PUT", async () => {
    const f = jsonFetch({ status: true, message: "Updated", data: {} });
    await deactivateSubaccount(SECRET, "ACCT_old", f);
    const [url, init] = f.mock.calls[0]!;
    expect(url).toBe("https://api.paystack.co/subaccount/ACCT_old");
    expect(init?.method).toBe("PUT");
    expect(JSON.parse(String(init?.body))).toEqual({ active: false });
  });
});
