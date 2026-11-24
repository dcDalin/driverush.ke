import { existsSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  boardCardPath,
  POSTER_SCHOOLS,
  posterPath,
  posterSchool,
} from "./poster";
import { SPONSORS } from "./sponsors";

const DAY = 86_400_000;
const PUBLIC = path.resolve(__dirname, "../../../public");

describe("the board's poster", () => {
  it("takes every live school in turn, one a day", () => {
    const live = SPONSORS.filter((s) => s.live).map((s) => s.id);
    expect(POSTER_SCHOOLS).toEqual(live);
    const start = Date.UTC(2026, 10, 24);
    const week = Array.from({ length: live.length }, (_, i) =>
      posterSchool(start + i * DAY),
    );
    expect(new Set(week).size).toBe(live.length);
  });

  it("keeps one school for the whole UTC day", () => {
    const start = Date.UTC(2026, 10, 24);
    expect(posterSchool(start)).toBe(posterSchool(start + DAY - 1));
    expect(posterSchool(start)).not.toBe(posterSchool(start + DAY));
  });

  it("has a still and a social card for every live school", () => {
    for (const school of POSTER_SCHOOLS) {
      for (const file of [
        posterPath(school),
        posterPath(school, 2400),
        boardCardPath(school),
      ]) {
        expect(existsSync(path.join(PUBLIC, file)), file).toBe(true);
      }
    }
  });
});
