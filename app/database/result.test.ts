import { describe, expect, it } from "vitest";

import { orThrow, reasonFor, toResult } from "./result";

describe("reasonFor", () => {
  it("names a refusal the database raised by its token", () => {
    expect(reasonFor({ code: "P0001", message: "admin_limit" })).toMatch(
      /50 admins/,
    );
  });
  it("covers a guard refusal and unknown failures", () => {
    expect(reasonFor({ code: "42501", message: "permission denied" })).toBe(
      "You cannot do that here.",
    );
    expect(reasonFor({ message: "boom" })).toBe(
      "Something went wrong. Try again.",
    );
  });
  it("never uses an em dash", () => {
    for (const message of [
      "forbidden",
      "admin_limit",
      "already_owner",
      "not_found",
      "x",
    ]) {
      expect(reasonFor({ message })).not.toContain("—");
    }
  });
});

describe("toResult and orThrow", () => {
  it("treats a void function's null data as success", () => {
    expect(toResult({ data: null, error: null })).toEqual({
      data: null,
      error: null,
    });
  });
  it("turns an error into a sentence", () => {
    expect(
      toResult({ data: null, error: { message: "not_pending" } }).error,
    ).toMatch(/already been answered/);
  });
  it("throws a read's error", () => {
    expect(() => orThrow({ data: null, error: { message: "nope" } })).toThrow();
    expect(orThrow({ data: [1], error: null })).toEqual([1]);
  });
});
