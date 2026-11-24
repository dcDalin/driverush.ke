import { describe, expect, it } from "vitest";

import {
  googleCalendarUrl,
  icsFile,
  icsHref,
  reminderDays,
} from "./test-reminder";

const today = "2026-11-24";

describe("reminderDays", () => {
  it("runs from tomorrow to the day before the test", () => {
    expect(reminderDays({ date: "2026-12-06" }, today)).toEqual({
      first: "20261125",
      last: "20261205",
      count: 11,
    });
  });

  it("crosses a month and a year", () => {
    expect(reminderDays({ date: "2027-01-02" }, "2026-12-30")).toEqual({
      first: "20261231",
      last: "20270101",
      count: 2,
    });
  });

  it("has nothing to remind of when the test is tomorrow or sooner", () => {
    expect(reminderDays({}, today)).toBeNull();
    expect(reminderDays({ date: today }, today)).toBeNull();
    expect(reminderDays({ date: "2026-11-25" }, today)).toBeNull();
    expect(reminderDays({ date: "2026-11-26" }, today)?.count).toBe(1);
  });
});

describe("googleCalendarUrl", () => {
  it("adds a 15-minute event at 19:00 Nairobi, daily until the eve", () => {
    const url = new URL(googleCalendarUrl({ date: "2026-12-06" }, today)!);
    expect(url.origin + url.pathname).toBe(
      "https://calendar.google.com/calendar/render",
    );
    expect(url.searchParams.get("action")).toBe("TEMPLATE");
    expect(url.searchParams.get("dates")).toBe(
      "20261125T160000Z/20261125T161500Z",
    );
    expect(url.searchParams.get("recur")).toBe("RRULE:FREQ=DAILY;COUNT=11");
    expect(url.searchParams.get("ctz")).toBe("Africa/Nairobi");
    expect(url.searchParams.get("details")).toContain(
      "https://driverush.ke/model-town-board",
    );
  });

  it("is not offered without days to remind on", () => {
    expect(googleCalendarUrl({ date: "2026-11-25" }, today)).toBeNull();
  });
});

describe("icsFile", () => {
  const now = Date.UTC(2026, 10, 24, 9, 30, 0);

  it("is a valid daily event with an alarm, in CRLF lines", () => {
    const file = icsFile({ date: "2026-12-06" }, today, now)!;
    const lines = file.split("\r\n");
    expect(lines[0]).toBe("BEGIN:VCALENDAR");
    expect(lines).toContain("DTSTAMP:20261124T093000Z");
    expect(lines).toContain("DTSTART:20261125T160000Z");
    expect(lines).toContain("DTEND:20261125T161500Z");
    expect(lines).toContain("RRULE:FREQ=DAILY;COUNT=11");
    expect(lines).toContain("UID:practice-2026-12-06@driverush.ke");
    expect(lines).toContain("BEGIN:VALARM");
    expect(file).not.toMatch(/[^\r]\n/);
    // the URL's colon is fine, but the text's comma-free wording stays plain
    expect(lines.find((l) => l.startsWith("DESCRIPTION:A few"))).toContain(
      "https://driverush.ke/model-town-board",
    );
  });

  it("comes as a data link a tap can open", () => {
    const href = icsHref({ date: "2026-12-06" }, today, now)!;
    expect(href.startsWith("data:text/calendar;charset=utf-8,")).toBe(true);
    expect(decodeURIComponent(href.split(",").slice(1).join(","))).toBe(
      icsFile({ date: "2026-12-06" }, today, now),
    );
    expect(icsHref({}, today, now)).toBeNull();
  });
});
