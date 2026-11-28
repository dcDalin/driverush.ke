import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  DEFAULT_LIVERY_META,
  LiveryMetaSchema,
  liveryRow,
  planLivery,
} from "./livery-files";

const FIXTURES = path.resolve(__dirname, "../../../seed/fixtures/liveries");

function namesIn(dir: string, prefix = ""): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory()
      ? namesIn(full, `${prefix}${name}/`)
      : [`${prefix}${name}`];
  });
}

describe("a livery folder", () => {
  const schools = readdirSync(FIXTURES);

  it("is whole for every school the seed publishes", () => {
    expect(schools.length).toBeGreaterThanOrEqual(5);
    for (const school of schools) {
      const plan = planLivery(namesIn(path.join(FIXTURES, school)));
      expect(plan.missing, school).toEqual([]);
      expect(plan.counts.cars, school).toBe(8);
      expect(plan.hasMeta, school).toBe(true);
    }
  });

  it("has a livery.json the console's form can read", () => {
    for (const school of schools) {
      const raw = JSON.parse(
        readFileSync(path.join(FIXTURES, school, "livery.json"), "utf8"),
      ) as Record<string, unknown>;
      expect(LiveryMetaSchema.safeParse(raw).success, school).toBe(true);
    }
  });

  it("names what is missing", () => {
    const plan = planLivery(["saloon-wrap4-hi.webp", "topboard.webp"]);
    expect(plan.missing).toContain("at least one car's wrap4-hi and -lo");
    expect(plan.missing).toContain("banner-hi.webp");
    expect(plan.missing).toContain("logo-mono.png");
  });

  it("becomes a row once every part is stored", () => {
    const names = namesIn(path.join(FIXTURES, "heltz"));
    const plan = planLivery(names);
    const id = "11111111-2222-3333-4444-555555555555";
    const paths = Object.fromEntries(
      plan.parts.map((p, i) => [
        p.key,
        `${id}/livery/${i.toString(16).padStart(16, "0")}.webp`,
      ]),
    );
    const row = liveryRow(
      id,
      { ...DEFAULT_LIVERY_META, label: "Test" },
      plan.cars,
      paths,
      { width: 1024, height: 341 },
    );
    expect(Object.keys(row.paint)).toHaveLength(8);
    expect(row.top_board).toMatchObject({
      width: 1024,
      height: 341,
      metres: { width: 1.35 },
    });
    expect(Object.keys(row.thumbs)).toHaveLength(plan.counts.thumbs);
    expect(Object.keys(row.stills).sort()).toEqual([
      "og",
      "poster",
      "poster_2400",
    ]);
  });
});
