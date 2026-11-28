import { describe, expect, it } from "vitest";

import type { Entitlement } from "~/database/types";

import { hasFullAccess, liveryRule } from "./entitlement";

const base: Entitlement = {
  tier: "free",
  school_id: null,
  school_name: null,
  school_slug: null,
  branch_id: null,
  ends_at: null,
  pending_invites: 0,
  full_access: false,
  pass_ends_at: null,
};

const PASS_END = "2027-01-24T10:00:00Z";

describe("liveryRule", () => {
  it("lets guests and free accounts see the schools take turns", () => {
    expect(liveryRule(null)).toEqual({ kind: "rotate" });
    expect(liveryRule(base)).toEqual({ kind: "rotate" });
  });
  it("dresses a school's learner in that school's livery", () => {
    expect(
      liveryRule({ ...base, tier: "school", school_slug: "heltz" }),
    ).toEqual({ kind: "school", sponsorId: "heltz" });
  });
  it("gives a school without livery art plain cars", () => {
    expect(liveryRule({ ...base, tier: "school", school_slug: null })).toEqual({
      kind: "plain",
    });
  });
  it("lets a paying learner with no school see the schools take turns", () => {
    expect(liveryRule({ ...base, tier: "paid", full_access: true })).toEqual({
      kind: "rotate",
    });
  });
});

describe("hasFullAccess", () => {
  it("opens while a pass runs, alone or through a school", () => {
    const pass = { full_access: true, pass_ends_at: PASS_END };
    expect(hasFullAccess({ ...base, ...pass, tier: "paid" })).toBe(true);
    expect(hasFullAccess({ ...base, ...pass, tier: "school" })).toBe(true);
  });
  it("stays shut for a school link alone, free accounts and guests", () => {
    expect(hasFullAccess({ ...base, tier: "school" })).toBe(false);
    expect(hasFullAccess(base)).toBe(false);
    expect(hasFullAccess(null)).toBe(false);
  });
});
