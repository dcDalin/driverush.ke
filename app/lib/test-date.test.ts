import { describe, expect, it } from "vitest";

import {
  ASK_AFTER_LEVELS,
  cardStage,
  daysBetween,
  daysLeft,
  isDay,
  parseTestRecord,
  testBucket,
} from "./test-date";

describe("daysBetween", () => {
  it("counts whole days either way, across months and years", () => {
    expect(daysBetween("2026-11-21", "2026-11-21")).toBe(0);
    expect(daysBetween("2026-11-21", "2026-12-01")).toBe(10);
    expect(daysBetween("2026-12-31", "2027-01-01")).toBe(1);
    expect(daysBetween("2026-11-21", "2026-11-20")).toBe(-1);
  });
});

describe("isDay", () => {
  it("takes real days only", () => {
    expect(isDay("2026-02-28")).toBe(true);
    expect(isDay("2026-02-30")).toBe(false);
    expect(isDay("21/11/2026")).toBe(false);
    expect(isDay(undefined)).toBe(false);
  });
});

describe("cardStage", () => {
  const today = "2026-11-21";

  it("asks for the date only after a few levels", () => {
    expect(cardStage({}, ASK_AFTER_LEVELS - 1, today)).toBeNull();
    expect(cardStage({}, ASK_AFTER_LEVELS, today)).toBe("date");
  });

  it("waits two weeks after being put off", () => {
    expect(cardStage({ putOff: "2026-11-10" }, 10, today)).toBeNull();
    expect(cardStage({ putOff: "2026-11-07" }, 10, today)).toBe("date");
  });

  it("asks nothing while the test is still to come, or on the day", () => {
    expect(cardStage({ date: "2026-12-01" }, 10, today)).toBeNull();
    expect(cardStage({ date: today }, 10, today)).toBeNull();
  });

  it("asks how it went from the day after the test", () => {
    expect(cardStage({ date: "2026-11-20" }, 10, today)).toBe("result");
    // Even with few levels: they gave a date, so they're asked.
    expect(cardStage({ date: "2026-11-01" }, 0, today)).toBe("result");
  });

  it("asks again two weeks after 'Not taken yet'", () => {
    const record = { date: "2026-11-01", result: "not_yet" as const };
    expect(
      cardStage({ ...record, resultDay: "2026-11-15" }, 10, today),
    ).toBeNull();
    expect(cardStage({ ...record, resultDay: "2026-11-07" }, 10, today)).toBe(
      "result",
    );
  });

  it("stops once there's a result", () => {
    expect(
      cardStage({ date: "2026-11-01", result: "passed" }, 10, today),
    ).toBeNull();
    expect(
      cardStage({ date: "2026-11-01", result: "failed" }, 10, today),
    ).toBeNull();
  });
});

describe("daysLeft and testBucket", () => {
  const today = "2026-11-21";
  it("say how far off the test is", () => {
    expect(daysLeft({}, today)).toBeNull();
    expect(daysLeft({ date: "2026-11-28" }, today)).toBe(7);
    expect(daysLeft({ date: "2026-11-20" }, today)).toBeNull();
    expect(testBucket({}, today)).toBe("none");
    expect(testBucket({ date: "2026-11-20" }, today)).toBe("past");
    expect(testBucket({ date: "2026-11-28" }, today)).toBe("0-7");
    expect(testBucket({ date: "2026-12-21" }, today)).toBe("8-30");
    expect(testBucket({ date: "2026-12-22" }, today)).toBe("31+");
  });
});

describe("parseTestRecord", () => {
  it("keeps good fields and drops the rest", () => {
    expect(
      parseTestRecord(
        JSON.stringify({ date: "2026-12-01", result: "maybe", putOff: 3 }),
      ),
    ).toEqual({ date: "2026-12-01" });
    expect(parseTestRecord("not json")).toEqual({});
    expect(parseTestRecord(null)).toEqual({});
  });
});
