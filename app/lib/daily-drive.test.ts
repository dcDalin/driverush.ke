import { describe, expect, it } from "vitest";

import { BOARD_CHALLENGES } from "./board/challenges";
import {
  dailyDriveHref,
  dailyDriveId,
  dailyOrder,
  isDailyDrive,
  kenyaDay,
  parseDailyRecord,
} from "./daily-drive";

describe("kenyaDay", () => {
  it("turns over at midnight in Nairobi, not UTC", () => {
    // 20:59 UTC on 24 Nov is 23:59 in Nairobi; 21:00 UTC is 00:00 on the 25th.
    expect(kenyaDay(Date.UTC(2026, 10, 24, 20, 59))).toBe("2026-11-24");
    expect(kenyaDay(Date.UTC(2026, 10, 24, 21, 0))).toBe("2026-11-25");
  });
});

describe("dailyOrder", () => {
  it("holds every task once, in a fixed order", () => {
    const order = dailyOrder();
    expect([...order].sort()).toEqual(BOARD_CHALLENGES.map((t) => t.id).sort());
    expect(dailyOrder()).toEqual(order);
    // shuffled, not the list as written
    expect(order).not.toEqual(BOARD_CHALLENGES.map((t) => t.id));
  });
});

describe("dailyDriveId", () => {
  it("is the same all day, for everyone", () => {
    expect(dailyDriveId("2026-11-24")).toBe(dailyDriveId("2026-11-24"));
  });

  it("gives every task before any comes back, never the same two days running", () => {
    const n = BOARD_CHALLENGES.length;
    const start = Date.UTC(2026, 10, 24);
    const days = Array.from({ length: n * 2 + 1 }, (_, i) =>
      new Date(start + i * 86_400_000).toISOString().slice(0, 10),
    );
    const ids = days.map((d) => dailyDriveId(d));
    expect(new Set(ids.slice(0, n)).size).toBe(n);
    for (let i = 1; i < ids.length; i += 1) {
      expect(ids[i], days[i]).not.toBe(ids[i - 1]);
    }
    // every id is a real task
    for (const id of ids)
      expect(BOARD_CHALLENGES.some((t) => t.id === id)).toBe(true);
  });
});

describe("isDailyDrive", () => {
  const day = "2026-11-24";
  const id = dailyDriveId(day);

  it("is today's task, opened as the daily drive", () => {
    expect(isDailyDrive(id, "1", day)).toBe(true);
    expect(isDailyDrive(id, null, day)).toBe(false);
  });

  it("is not yesterday's link opened today", () => {
    expect(isDailyDrive(dailyDriveId("2026-11-23"), "1", day)).toBe(false);
  });
});

describe("dailyDriveHref and parseDailyRecord", () => {
  it("opens the task in the game, marked daily", () => {
    expect(dailyDriveHref("turn-back")).toBe(
      "/model-town-board/play?task=turn-back&daily=1",
    );
  });

  it("keeps good records and drops the rest", () => {
    expect(
      parseDailyRecord('{"day":"2026-11-24","id":"left","clean":true}'),
    ).toEqual({ day: "2026-11-24", id: "left", clean: true });
    expect(parseDailyRecord('{"day":"2026-11-24"}')).toBeNull();
    expect(parseDailyRecord("not json")).toBeNull();
    expect(parseDailyRecord(null)).toBeNull();
  });
});
