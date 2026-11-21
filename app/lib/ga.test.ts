import { describe, expect, it } from "vitest";

import { gaHeadScript, sanitizeGaParams } from "./ga";

describe("sanitizeGaParams", () => {
  it("drops empty values and trims to GA4's limits", () => {
    const out = sanitizeGaParams({
      a: undefined,
      b: null,
      c: "x".repeat(150),
      d: Number.NaN,
      e: 3,
      f: false,
      ["k".repeat(50)]: "v",
    });
    expect(out).toEqual({
      c: "x".repeat(100),
      e: 3,
      f: false,
      ["k".repeat(40)]: "v",
    });
  });

  it("keeps at most 25 parameters", () => {
    const many = Object.fromEntries(
      Array.from({ length: 30 }, (_, i) => [`p${i}`, i]),
    );
    expect(Object.keys(sanitizeGaParams(many))).toHaveLength(25);
  });
});

describe("gaHeadScript", () => {
  it("is empty when this environment has no GA property", () => {
    expect(
      gaHeadScript(
        { path: "/", content_group: "Home", page_template: "/" },
        "",
      ),
    ).toBe("");
  });

  it("is valid JavaScript that can't be broken out of", () => {
    const script = gaHeadScript(
      {
        path: "/</script><script>alert(1)",
        content_group: "Home",
        page_template: "/",
      },
      "G-TEST",
    );
    expect(script).not.toContain("</script>");
    expect(() => new Function(script)).not.toThrow();
  });

  it("stays quiet in a headless or bot browser, and measures a phone", () => {
    const script = gaHeadScript(
      { path: "/", content_group: "Home", page_template: "/" },
      "G-TEST",
    );
    const run = (navigator: Record<string, unknown>) => {
      const win: Record<string, unknown> = {};
      const store = () => ({
        getItem: () => null,
        setItem() {},
        removeItem() {},
      });
      new Function(
        "window",
        "location",
        "document",
        "navigator",
        "sessionStorage",
        "localStorage",
        "matchMedia",
        script,
      )(
        win,
        { search: "", pathname: "/", origin: "https://driverush.ke" },
        {
          title: "Home",
          referrer: "",
          createElement: () => ({}),
          head: { appendChild() {} },
        },
        navigator,
        store(),
        store(),
        () => ({ matches: false }),
      );
      return "__drGa" in win;
    };
    const phone =
      "Mozilla/5.0 (Linux; Android 11; CUBOT X30) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";
    expect(run({ userAgent: phone })).toBe(true);
    expect(run({ userAgent: phone, webdriver: true })).toBe(false);
    expect(
      run({ userAgent: "Mozilla/5.0 HeadlessChrome/131.0.0.0 Safari/537.36" }),
    ).toBe(false);
    expect(run({ userAgent: "Mozilla/5.0 (compatible; Googlebot/2.1)" })).toBe(
      false,
    );
    expect(
      run({
        userAgent: phone,
        userAgentData: { brands: [{ brand: "HeadlessChrome" }] },
      }),
    ).toBe(false);
  });
});
