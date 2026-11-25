/**
 * Seeds are local only (thinkrush `seed-list-is-local-only`). `supabase db
 * reset` runs exactly one SQL seed, and that file refuses to write unless
 * private.is_local_stack(); the TypeScript seed (seed/) only knows loopback
 * addresses. The repo is public, so no seed may carry a real address either:
 * every email in seed/ and supabase/seeds/ ends in .test, and the owner's own
 * su comes from SEED_SU_EMAIL in the gitignored .env.local.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "..", "..");

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    if (name === ".snaplet" || name === "node_modules") return [];
    const path = join(dir, name);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
}

const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

const SEED_FILES = [
  ...filesUnder(join(ROOT, "seed")),
  ...filesUnder(join(ROOT, "supabase", "seeds")),
];

describe("seeds stay local", () => {
  it("db reset runs only local_demo.sql", () => {
    const config = read("supabase/config.toml");
    const block = config.slice(config.indexOf("[db.seed]"));
    const paths = block.match(/sql_paths\s*=\s*\[([^\]]*)\]/)?.[1];
    expect(paths?.split(",").map((p) => p.trim().replace(/"/g, ""))).toEqual([
      "./seeds/local_demo.sql",
    ]);
  });

  it("local_demo.sql checks is_local_stack before it writes anything", () => {
    const sql = read("supabase/seeds/local_demo.sql").replace(/--.*$/gm, "");
    const doBlock = sql.indexOf("do $$");
    expect(doBlock).toBeGreaterThan(-1);
    // Before the block: only pg_temp helpers (gone when the session ends).
    const before = sql.slice(0, doBlock);
    const topLevel = before.replace(/\$\$[\s\S]*?\$\$/g, "$$$$");
    for (const statement of topLevel
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean)) {
      expect(statement).toMatch(/^create function pg_temp\./);
    }
    const body = sql
      .slice(sql.indexOf("begin", doBlock) + "begin".length)
      .trim();
    expect(body).toMatch(/^if not private\.is_local_stack\(\) then/);
  });

  it("the TypeScript seed knows only loopback addresses", () => {
    const urls = SEED_FILES.filter((f) => f.endsWith(".ts")).flatMap(
      (f) =>
        readFileSync(f, "utf8").match(
          /\b(?:https?|postgres(?:ql)?):\/\/[^\s"'`]+/g,
        ) ?? [],
    );
    expect(urls.length).toBeGreaterThan(0);
    for (const url of urls) {
      expect(new URL(url).hostname, url).toMatch(
        /^(127\.0\.0\.1|localhost|\[::1\])$/,
      );
    }
  });

  it("no committed seed carries a real email address", () => {
    const outside = SEED_FILES.flatMap((f) =>
      (
        readFileSync(f, "utf8").match(/[\w.+-]+@(?:[\w-]+\.)+[a-z]{2,}\b/gi) ??
        []
      )
        .filter((email) => !email.endsWith(".test"))
        .map((email) => `${f}: ${email}`),
    );
    expect(outside).toEqual([]);
  });
});
