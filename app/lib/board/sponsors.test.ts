import { describe, expect, it } from "vitest";

import { resolveCar } from "~/lib/board/cars";
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

  it("takes turns: a learner gets the school after the one they saw last", () => {
    // whatever the roll
    for (const roll of [0, 0.5, 0.99]) {
      expect(pickSponsor({ roll, now, list, last: "a" })?.id).toBe("b");
      expect(pickSponsor({ roll, now, list, last: "b" })?.id).toBe("c");
      expect(pickSponsor({ roll, now, list, last: "c" })?.id).toBe("a");
    }
  });

  it("goes by the roll on a first visit, or after a school that has gone", () => {
    expect(pickSponsor({ roll: 0.5, now, list, last: null })?.id).toBe("b");
    expect(pickSponsor({ roll: 0.5, now, list, last: "left" })?.id).toBe("b");
  });

  it("skips a school that is not live when taking turns", () => {
    const some = [school("a"), school("x", { live: false }), school("c")];
    expect(pickSponsor({ roll: 0, now, list: some, last: "a" })?.id).toBe("c");
    expect(pickSponsor({ roll: 0, now, list: some, last: "c" })?.id).toBe("a");
    // With one live school, it is that school every visit.
    const one = [school("a"), school("x", { live: false })];
    expect(pickSponsor({ roll: 0.9, now, list: one, last: "a" })?.id).toBe("a");
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

describe("the car a learner gets with a sponsoring school", () => {
  it("keeps the car the learner picked, painted or not", () => {
    expect(resolveCar("pickup", 0.1, ["saloon"])).toBe("pickup");
  });

  it("gives 'Surprise me' only cars the school has paint for", () => {
    for (const roll of [0, 0.3, 0.6, 0.99]) {
      expect(["saloon", "suv"]).toContain(
        resolveCar("random", roll, ["saloon", "suv"]),
      );
    }
    expect(resolveCar(undefined, 0.99, ["suv"])).toBe("suv");
  });

  it("gives any car with no school, or a school with no paint", () => {
    const seen = new Set(
      [0, 0.4, 0.8].map((roll) => resolveCar("random", roll, [])),
    );
    expect(seen.size).toBe(3);
    expect(resolveCar("random", 0.99)).toBe("suv");
  });
});
