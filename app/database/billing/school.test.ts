import { describe, expect, it } from "vitest";

import { type EarningRow, earningsTotals } from "./school";

const row = (
  paid_at: string,
  share: number,
  status: EarningRow["status"] = "succeeded",
): EarningRow => ({
  payment_id: paid_at,
  paid_at,
  learner_email: "l@example.test",
  branch_id: null,
  branch_name: null,
  price_kes: share + 300,
  school_share_kes: share,
  status,
});

describe("earningsTotals", () => {
  it("adds this month and last month in Nairobi's calendar, refunds left out", () => {
    const now = Date.parse("2026-12-10T08:00:00Z");
    const totals = earningsTotals(
      [
        row("2026-12-02T10:00:00Z", 400),
        row("2026-12-03T10:00:00Z", 400, "refunded"),
        // 30 November, 23:30 in Nairobi: still November.
        row("2026-11-30T20:30:00Z", 300),
        // 30 November, 21:30 UTC is 1 December, 00:30 in Nairobi.
        row("2026-11-30T21:30:00Z", 200),
        row("2026-10-15T10:00:00Z", 999),
      ],
      now,
    );
    expect(totals).toEqual({
      thisMonth: { kes: 600, learners: 2 },
      lastMonth: { kes: 300, learners: 1 },
    });
  });

  it("knows December comes before January", () => {
    const totals = earningsTotals(
      [row("2026-12-20T10:00:00Z", 400)],
      Date.parse("2027-01-05T10:00:00Z"),
    );
    expect(totals.lastMonth).toEqual({ kes: 400, learners: 1 });
  });
});
