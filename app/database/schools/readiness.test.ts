import { describe, expect, it } from "vitest";

import { schoolReadiness } from "./readiness";

const full = {
  logo: { path: "x/logo/0123456789abcdef.webp" },
  tagline: "Learn with us",
  about: null,
  openBranches: 1,
};

describe("when a school is ready to be public", () => {
  it("needs a logo, some profile text and an open branch", () => {
    expect(schoolReadiness(full).ready).toBe(true);
    expect(
      schoolReadiness({ ...full, tagline: null, about: "Since 1999" }),
    ).toMatchObject({ profile: true, ready: true });
  });
  it("is not ready with any one missing", () => {
    expect(schoolReadiness({ ...full, logo: null })).toMatchObject({
      logo: false,
      ready: false,
    });
    expect(schoolReadiness({ ...full, tagline: null })).toMatchObject({
      profile: false,
      ready: false,
    });
    expect(schoolReadiness({ ...full, openBranches: 0 })).toMatchObject({
      branch: false,
      ready: false,
    });
  });
});
