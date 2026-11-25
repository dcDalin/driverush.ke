import { describe, expect, it } from "vitest";

import {
  callbackUrl,
  cleanCode,
  normalizeEmail,
  signInErrorMessage,
} from "./sign-in";

describe("normalizeEmail", () => {
  it("trims and lower-cases an address", () => {
    expect(normalizeEmail("  Wanjiru@Mail.COM ")).toBe("wanjiru@mail.com");
  });
  it("refuses something that is not an address", () => {
    expect(normalizeEmail("wanjiru")).toBeNull();
    expect(normalizeEmail("wanjiru@mail")).toBeNull();
    expect(normalizeEmail("a b@mail.com")).toBeNull();
  });
});

describe("cleanCode", () => {
  it("keeps six digits from a pasted code", () => {
    expect(cleanCode("123 456")).toBe("123456");
    expect(cleanCode("1234567")).toBe("123456");
    expect(cleanCode("12a3")).toBe("123");
  });
});

describe("callbackUrl", () => {
  it("returns to the page the learner was on", () => {
    expect(
      callbackUrl("https://driverush.ke", "/model-town-board/levels"),
    ).toBe(
      "https://driverush.ke/auth/callback?next=%2Fmodel-town-board%2Flevels",
    );
  });
  it("never sends anyone to another site", () => {
    expect(callbackUrl("https://driverush.ke", "//evil.test")).toBe(
      "https://driverush.ke/auth/callback?next=%2F",
    );
    expect(callbackUrl("https://driverush.ke", "https://evil.test")).toBe(
      "https://driverush.ke/auth/callback?next=%2F",
    );
  });
});

describe("signInErrorMessage", () => {
  it("explains a wrong or expired code", () => {
    expect(
      signInErrorMessage({
        code: "otp_expired",
        status: 403,
        message: "Token has expired or is invalid",
      }),
    ).toMatch(/expired or is wrong/);
  });
  it("explains a wrong password", () => {
    expect(
      signInErrorMessage({
        code: "invalid_credentials",
        status: 400,
        message: "",
      }),
    ).toMatch(/do not match/);
  });
  it("explains too many tries", () => {
    expect(signInErrorMessage({ code: "", status: 429, message: "" })).toMatch(
      /Too many tries/,
    );
  });
  it("falls back to a plain sentence", () => {
    expect(signInErrorMessage(undefined)).toBe(
      "Something went wrong. Try again.",
    );
  });
  it("never uses an em dash", () => {
    for (const code of [
      "otp_expired",
      "invalid_credentials",
      "email_not_confirmed",
      "provider_disabled",
      "x",
    ]) {
      expect(
        signInErrorMessage({ code, status: 400, message: "" }),
      ).not.toContain("—");
    }
  });
});
