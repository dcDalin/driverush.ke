import { describe, expect, it } from "vitest";

import { inPeriod, pickSponsor, type Sponsor } from "~/lib/board/sponsors";

const school = (id: string, extra: Partial<Sponsor> = {}): Sponsor => ({
  id,
  school: `${id} Driving School`,
  colors: { paint: "#000", ink: "#000" },
  logo: { full: "", mono: "" },
  live: true,
  ...extra,
});

const now = new Date("2026-12-01T09:00:00Z");

describe("pickSponsor", () => {
  const list = [school("a"), school("b"), school("c")];

  it("spreads visits over every live school by the roll", () => {
    const seen = [0, 0.34, 0.67, 0.999].map(
      (roll) => pickSponsor({ roll, now, list })?.id,
    );
    expect(seen).toEqual(["a", "b", "c", "c"]);
  });

  it("never picks a school that is not live", () => {
    const hidden = [school("a", { live: false }), school("b")];
    for (const roll of [0, 0.5, 0.99]) {
      expect(pickSponsor({ roll, now, list: hidden })?.id).toBe("b");
    }
  });

  it("drops a school outside its paid period", () => {
    const dated = [
      school("old", { until: "2026-11-30" }),
      school("soon", { from: "2026-12-15" }),
      school("now", { from: "2026-11-01", until: "2027-01-01" }),
    ];
    expect(pickSponsor({ roll: 0, now, list: dated })?.id).toBe("now");
    expect(inPeriod(dated[0], now)).toBe(false);
    expect(inPeriod(dated[1], now)).toBe(false);
  });

  it("lets ?sponsor= show any school, live or not", () => {
    const hidden = [school("a"), school("x", { live: false })];
    expect(pickSponsor({ roll: 0, now, list: hidden, override: "x" })?.id).toBe(
      "x",
    );
    // An unknown id falls through to the usual pick.
    expect(
      pickSponsor({ roll: 0, now, list: hidden, override: "nope" })?.id,
    ).toBe("a");
  });

  it("gives a learner the school their email belongs to", () => {
    const withMail = [
      school("a"),
      school("b", { emailMatch: ["@bschool.co.ke", "Owner@Gmail.com"] }),
    ];
    const pick = (email: string) =>
      pickSponsor({ roll: 0, now, list: withMail, email })?.id;
    expect(pick("learner@bschool.co.ke")).toBe("b");
    expect(pick("owner@gmail.com")).toBe("b");
    expect(pick("someone@gmail.com")).toBe("a");
  });

  it("falls back to the default school, or none", () => {
    const none = [school("a", { live: false })];
    expect(pickSponsor({ roll: 0, now, list: none })).toBeNull();
    expect(pickSponsor({ roll: 0, now, list: none, fallback: "a" })?.id).toBe(
      "a",
    );
  });
});
