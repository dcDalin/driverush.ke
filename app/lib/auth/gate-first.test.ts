/**
 * Every loader and action of a route that touches accounts starts with a
 * gate (thinkrush `gate-first.unit.test.ts`): `getRequestClient`,
 * `requireUser` or `requireStaff`. A data request can run a child route's
 * loader on its own, so no route may rely on a parent having checked.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const ROUTES = path.resolve(__dirname, "../../routes");
const GATED = /^(school-|console|api\/)/;
const GATES = /await (getRequestClient|requireUser|requireStaff)\(request\)/;

function files(dir: string, prefix = ""): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? files(path.join(dir, entry.name), `${prefix}${entry.name}/`)
      : [`${prefix}${entry.name}`],
  );
}

describe("gate first", () => {
  const gated = files(ROUTES).filter(
    (file) => GATED.test(file) && /\.tsx?$/.test(file),
  );

  it("finds the account routes", () => {
    expect(gated.length).toBeGreaterThanOrEqual(4);
  });

  for (const file of gated) {
    it(`${file}: every loader and action opens with a gate`, () => {
      const source = readFileSync(path.join(ROUTES, file), "utf8");
      const bodies = [
        ...source.matchAll(
          /export async function (loader|action)\([^)]*\)[^{]*\{([\s\S]*?)\n\}/g,
        ),
      ];
      for (const [, name, body] of bodies) {
        const first = body!
          .split("\n")
          .find((line) => line.trim() !== "" && !line.trim().startsWith("//"));
        expect(first, `${file} ${name}`).toMatch(GATES);
      }
    });
  }
});
