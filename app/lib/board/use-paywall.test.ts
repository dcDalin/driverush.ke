import { describe, expect, it } from "vitest";

import { ALL_LEVELS, COURSE_LEVELS, MOCK_LEVEL_ID } from "./curriculum";
import { FREE_LEVELS } from "./paywall";
import { mightBeLocked, passesOn, passHref } from "./use-paywall";

const level = (n: number) => COURSE_LEVELS.find((l) => l.n === n)!;
const mock = ALL_LEVELS.find((l) => l.id === MOCK_LEVEL_ID)!;

describe("the paywall switch", () => {
  it("is off unless the build turns it on", () => {
    expect(passesOn({})).toBe(false);
    expect(passesOn({ VITE_PASSES: "" })).toBe(false);
    expect(passesOn({ VITE_PASSES: "on" })).toBe(true);
  });
});

describe("passHref", () => {
  it("comes back to the level, or to the board for the mock test", () => {
    expect(passHref(level(FREE_LEVELS + 1))).toBe(
      `/pass?level=${level(FREE_LEVELS + 1).id}`,
    );
    expect(passHref(mock)).toBe("/pass");
  });
});

describe("mightBeLocked", () => {
  it("waits for the answer only where a pass could matter", () => {
    expect(mightBeLocked(level(FREE_LEVELS))).toBe(false);
    expect(mightBeLocked(level(FREE_LEVELS + 1))).toBe(true);
    expect(mightBeLocked(mock)).toBe(true);
  });
});
