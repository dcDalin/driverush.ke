/**
 * A daily practice reminder in the learner's own calendar, from tomorrow to
 * the day before their NTSA test. There are no accounts and no push
 * notifications, so this is the one reminder that reaches a learner outside
 * the app. Two ways in: a Google Calendar link (most Android phones), and an
 * .ics file for an iPhone or any other calendar.
 *
 * Nothing is sent anywhere until the learner taps one. Pure: the record and
 * the day go in, the link or the file comes out.
 */
import { daysBetween, type TestRecord } from "./test-date";

const TITLE = "Practise for my NTSA test";
const DETAILS =
  "A few levels of the Model Town Board on DriveRush: https://driverush.ke/model-town-board";
const PLACE = "https://driverush.ke/model-town-board";

/** 19:00 in Nairobi (UTC+3, no daylight saving) is 16:00 UTC. */
const START_UTC = "160000";
const END_UTC = "161500";

/** `YYYY-MM-DD` plus `n` days, as `YYYYMMDD`. */
function compact(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const at = new Date(Date.UTC(y, m - 1, d + n));
  return at.toISOString().slice(0, 10).replaceAll("-", "");
}

export type ReminderDays = { first: string; last: string; count: number };

/**
 * The days the reminder runs, as `YYYYMMDD`: tomorrow to the day before the
 * test. `null` when that leaves nothing (no date, or the test is tomorrow or
 * sooner).
 */
export function reminderDays(
  record: TestRecord,
  today: string,
): ReminderDays | null {
  if (!record.date) return null;
  const count = daysBetween(today, record.date) - 1;
  if (count < 1) return null;
  return {
    first: compact(today, 1),
    last: compact(record.date, -1),
    count,
  };
}

/** A Google Calendar "add event" link, repeating daily until the eve. */
export function googleCalendarUrl(
  record: TestRecord,
  today: string,
): string | null {
  const days = reminderDays(record, today);
  if (!days) return null;
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: TITLE,
    dates: `${days.first}T${START_UTC}Z/${days.first}T${END_UTC}Z`,
    ctz: "Africa/Nairobi",
    recur: `RRULE:FREQ=DAILY;COUNT=${days.count}`,
    details: DETAILS,
    location: PLACE,
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

/** Commas, semicolons and backslashes are special in an .ics text value. */
function icsText(text: string): string {
  return text.replace(/[\\;,]/g, (c) => `\\${c}`);
}

/** The same reminder as an .ics file, for an iPhone or any other calendar. */
export function icsFile(
  record: TestRecord,
  today: string,
  now: number,
): string | null {
  const days = reminderDays(record, today);
  if (!days) return null;
  const stamp = new Date(now)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//DriveRush//Practice reminder//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:practice-${record.date}@driverush.ke`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${days.first}T${START_UTC}Z`,
    `DTEND:${days.first}T${END_UTC}Z`,
    `RRULE:FREQ=DAILY;COUNT=${days.count}`,
    `SUMMARY:${icsText(TITLE)}`,
    `DESCRIPTION:${icsText(DETAILS)}`,
    `URL:${PLACE}`,
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${icsText(TITLE)}`,
    "TRIGGER:PT0M",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}

/** The .ics as a link a tap downloads (or, on an iPhone, offers to add). */
export function icsHref(
  record: TestRecord,
  today: string,
  now: number,
): string | null {
  const file = icsFile(record, today, now);
  return file
    ? `data:text/calendar;charset=utf-8,${encodeURIComponent(file)}`
    : null;
}

export const ICS_NAME = "driverush-practice.ics";
