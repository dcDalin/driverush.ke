import { describe, expect, it } from "vitest";

import { boardCardPath, posterPath, posterSchool } from "./poster";
import type { Sponsor } from "./school-catalog";

const DAY = 86_400_000;

const school = (id: string, extra: Partial<Sponsor> = {}): Sponsor => ({
  id,
  school: id,
  colors: { paint: "#000000", ink: "#000000" },
  logo: { full: "", mono: "" },
  thumbs: {},
  stills: {
    poster: `https://cdn.test/${id}.jpg`,
    og: `https://cdn.test/${id}-og.jpg`,
  },
  live: true,
  ...extra,
});

describe("the board's poster", () => {
  const list = [school("a"), school("b"), school("c")];

  it("takes every sponsoring school with a still in turn, one a day", () => {
    const start = Date.UTC(2026, 10, 24);
    const week = Array.from(
      { length: list.length },
      (_, i) => posterSchool(start + i * DAY, list)?.id,
    );
    expect(new Set(week).size).toBe(list.length);
  });

  it("keeps one school for the whole UTC day", () => {
    const start = Date.UTC(2026, 10, 24);
    expect(posterSchool(start, list)).toBe(posterSchool(start + DAY - 1, list));
    expect(posterSchool(start, list)).not.toBe(posterSchool(start + DAY, list));
  });

  it("leaves out schools that are not sponsoring or have no still", () => {
    const some = [
      school("a", { live: false }),
      school("b", { stills: {} }),
      school("c"),
    ];
    for (let day = 0; day < 4; day++) {
      expect(posterSchool(day * DAY, some)?.id).toBe("c");
    }
  });

  it("falls back to the plain card with no school", () => {
    expect(posterSchool(0, [])).toBeNull();
    expect(posterPath(null)).toBe("/og/board.jpg");
    expect(posterPath(null, 2400)).toBe("/og/board.jpg");
    expect(boardCardPath(null)).toBe("/og/board.jpg");
  });

  it("uses the school's still, and the 1200 one where no 2400 exists", () => {
    const a = school("a");
    expect(posterPath(a)).toBe("https://cdn.test/a.jpg");
    expect(posterPath(a, 2400)).toBe("https://cdn.test/a.jpg");
    expect(boardCardPath(a)).toBe("https://cdn.test/a-og.jpg");
  });
});
