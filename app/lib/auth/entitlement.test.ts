import { describe, expect, it } from "vitest";

import type { Entitlement } from "~/lib/supabase/types";

import { hasFullAccess, liveryRule } from "./entitlement";

const base: Entitlement = {
  tier: "free",
  school_id: null,
  school_name: null,
  sponsor_id: null,
  branch_id: null,
  ends_at: null,
  pending_invites: 0,
};

describe("liveryRule", () => {
  it("lets guests and free accounts see the schools take turns", () => {
    expect(liveryRule(null)).toEqual({ kind: "rotate" });
    expect(liveryRule(base)).toEqual({ kind: "rotate" });
  });
  it("dresses a school's learner in that school's livery", () => {
    expect(
      liveryRule({ ...base, tier: "school", sponsor_id: "heltz" }),
    ).toEqual({ kind: "school", sponsorId: "heltz" });
  });
  it("gives a school without livery art plain cars", () => {
    expect(liveryRule({ ...base, tier: "school", sponsor_id: null })).toEqual({
      kind: "plain",
    });
  });
  it("gives a paying learner with no school plain cars", () => {
    expect(liveryRule({ ...base, tier: "paid" })).toEqual({ kind: "plain" });
  });
});

describe("hasFullAccess", () => {
  it("opens for school and paid, not free or guests", () => {
    expect(hasFullAccess({ ...base, tier: "school" })).toBe(true);
    expect(hasFullAccess({ ...base, tier: "paid" })).toBe(true);
    expect(hasFullAccess(base)).toBe(false);
    expect(hasFullAccess(null)).toBe(false);
  });
});
