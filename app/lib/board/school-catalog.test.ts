import { describe, expect, it } from "vitest";

import { BOARD_CARS, resolveCar } from "~/lib/board/cars";
import type { BoardSchool } from "~/schemas/board-schools";

import {
  askedSchool,
  mediaUrl,
  pickSponsor,
  type Sponsor,
  toSponsor,
} from "./school-catalog";

const school = (id: string, extra: Partial<Sponsor> = {}): Sponsor => ({
  id,
  school: `${id} Driving School`,
  colors: { paint: "#000000", ink: "#000000" },
  logo: { full: "", mono: "" },
  thumbs: {},
  stills: {},
  live: true,
  ...extra,
});

const BASE = "http://127.0.0.1:54721";
const SCHOOL = "11111111-2222-3333-4444-555555555555";
const path = (kind: "logo" | "livery", n: number) =>
  `${SCHOOL}/${kind}/${n.toString(16).padStart(16, "0")}.webp`;

const row: BoardSchool = {
  slug: "heltz",
  name: "Heltz Driving Academy",
  sponsoring: true,
  profile: {
    tagline: null,
    about: null,
    phone: null,
    whatsapp: null,
    email: null,
    website_url: "https://heltz.test",
    socials: {},
    brand_paint: "#f4a20c",
    brand_ink: "#1d2fc2",
    logo: { path: path("logo", 1), width: 1024, height: 401 },
    logo_mono: null,
  },
  branches: [],
  livery: {
    id: "99999999-2222-3333-4444-555555555555",
    status: "live",
    base_color: "#f6f6f3",
    rail: { gold: "#f4a20c", red: "#e3271b" },
    paint: { saloon: { hi: path("livery", 2), lo: path("livery", 3) } },
    top_board: {
      path: path("livery", 4),
      width: 1024,
      height: 341,
      metres: { width: 1.35, height: 0.45 },
      cut: 0.04,
      edge: "#e3271b",
    },
    banner: { hi: path("livery", 5), lo: path("livery", 6) },
    posters: { logo: path("livery", 7), lessons: path("livery", 8) },
    marks: { full: path("livery", 9), mono: path("livery", 10) },
    thumbs: { saloon: path("livery", 11) },
    stills: { poster: path("livery", 12) },
  },
};

describe("toSponsor", () => {
  const sponsor = toSponsor(row, BASE);

  it("makes every media path a public Storage URL", () => {
    expect(sponsor.livery?.cars.saloon?.hi).toBe(
      mediaUrl(BASE, path("livery", 2)),
    );
    expect(sponsor.livery?.cars.saloon?.hi).toMatch(
      /^http:\/\/127\.0\.0\.1:54721\/storage\/v1\/object\/public\/school-media\//,
    );
    expect(sponsor.thumbs.saloon).toBe(mediaUrl(BASE, path("livery", 11)));
    expect(sponsor.stills.poster).toBe(mediaUrl(BASE, path("livery", 12)));
  });

  it("credits with the owner's logo, engraves with the livery's white marks", () => {
    expect(sponsor.logo.full).toBe(mediaUrl(BASE, path("logo", 1)));
    expect(sponsor.logo.mono).toBe(mediaUrl(BASE, path("livery", 10)));
  });

  it("carries the roof board in metres and the room's rail colours", () => {
    expect(sponsor.topBoard).toMatchObject({
      width: 1.35,
      height: 0.45,
      cut: 0.04,
    });
    expect(sponsor.room?.rail).toEqual({ gold: "#f4a20c", red: "#e3271b" });
  });

  it("rotates only while sponsoring with a live livery", () => {
    expect(sponsor.live).toBe(true);
    expect(toSponsor({ ...row, sponsoring: false }, BASE).live).toBe(false);
    expect(toSponsor({ ...row, livery: null }, BASE).live).toBe(false);
    expect(toSponsor({ ...row, livery: null }, BASE).livery).toBeUndefined();
  });

  it("never reads a URL from the row: only paths, joined to the project", () => {
    expect(mediaUrl(`${BASE}/`, "a/b.webp")).toBe(
      `${BASE}/storage/v1/object/public/school-media/a/b.webp`,
    );
  });
});

describe("the school asked for in the address (?school=)", () => {
  const list = [school("a"), school("hidden", { live: false })];

  it("is that school when it sponsors the board", () => {
    expect(askedSchool("a", { list })?.id).toBe("a");
  });

  it("is nothing for a wrong slug, or none at all", () => {
    expect(askedSchool("nope", { list })).toBeNull();
    expect(askedSchool("", { list })).toBeNull();
    expect(askedSchool(null, { list })).toBeNull();
  });

  it("is nothing for a school that does not sponsor now", () => {
    expect(askedSchool("hidden", { list })).toBeNull();
  });
});

describe("pickSponsor", () => {
  const list = [school("a"), school("b"), school("c")];

  it("spreads visits over every sponsoring school by the roll", () => {
    const seen = [0, 0.34, 0.67, 0.999].map(
      (roll) => pickSponsor({ roll, list })?.id,
    );
    expect(seen).toEqual(["a", "b", "c", "c"]);
  });

  it("takes turns: a learner gets the school after the one they saw last", () => {
    for (const roll of [0, 0.5, 0.99]) {
      expect(pickSponsor({ roll, list, last: "a" })?.id).toBe("b");
      expect(pickSponsor({ roll, list, last: "b" })?.id).toBe("c");
      expect(pickSponsor({ roll, list, last: "c" })?.id).toBe("a");
    }
  });

  it("goes by the roll on a first visit, or after a school that has gone", () => {
    expect(pickSponsor({ roll: 0.5, list, last: null })?.id).toBe("b");
    expect(pickSponsor({ roll: 0.5, list, last: "left" })?.id).toBe("b");
  });

  it("skips a school that is not sponsoring when taking turns", () => {
    const some = [school("a"), school("x", { live: false }), school("c")];
    expect(pickSponsor({ roll: 0, list: some, last: "a" })?.id).toBe("c");
    expect(pickSponsor({ roll: 0, list: some, last: "c" })?.id).toBe("a");
    const one = [school("a"), school("x", { live: false })];
    expect(pickSponsor({ roll: 0.9, list: one, last: "a" })?.id).toBe("a");
  });

  it("lets ?sponsor= show any school, sponsoring or not", () => {
    const hidden = [school("a"), school("x", { live: false })];
    expect(pickSponsor({ roll: 0, list: hidden, override: "x" })?.id).toBe("x");
    expect(pickSponsor({ roll: 0, list: hidden, override: "nope" })?.id).toBe(
      "a",
    );
  });

  it("is none with no sponsoring school (plain cars)", () => {
    expect(
      pickSponsor({ roll: 0, list: [school("a", { live: false })] }),
    ).toBeNull();
    expect(pickSponsor({ roll: 0, list: [] })).toBeNull();
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
    expect(resolveCar("random", 0.99)).toBe(
      BOARD_CARS[BOARD_CARS.length - 1]!.id,
    );
  });
});
