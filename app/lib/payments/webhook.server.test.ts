import { describe, expect, it } from "vitest";

import { callbackUrl } from "./pass-flow.server";
import { ourReference, refundReference } from "./webhook.server";

describe("references", () => {
  it("knows ours from anything else on the Paystack account", () => {
    expect(ourReference("dr_0123abcd")).toBe("dr_0123abcd");
    expect(ourReference("T123456")).toBeNull();
    expect(ourReference("dr_bad;drop")).toBeNull();
    expect(ourReference(42)).toBeNull();
  });

  it("finds a refund's transaction in either shape Paystack sends", () => {
    expect(refundReference({ transaction_reference: "dr_a1" })).toBe("dr_a1");
    expect(refundReference({ transaction: { reference: "dr_b2" } })).toBe(
      "dr_b2",
    );
    expect(refundReference({ transaction_reference: "T9" })).toBeNull();
  });
});

describe("callbackUrl", () => {
  it("returns to /pass/done on the same site, with the level", () => {
    expect(
      callbackUrl("https://driverush.ke/pass?code=HELTZ", "drive-straight"),
    ).toBe("https://driverush.ke/pass/done?level=drive-straight");
    expect(callbackUrl("http://localhost:5730/pass")).toBe(
      "http://localhost:5730/pass/done",
    );
  });
});
