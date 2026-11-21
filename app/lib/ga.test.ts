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
});
