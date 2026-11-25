import { describe, expect, it } from "vitest";

import { fromRow, planSync, sameValue, toRow } from "./sync-plan";

const base = {
  stores: ["board", "streak"] as const,
  legacy: {},
  alreadySyncing: false,
};

describe("planSync", () => {
  it("uploads what only the phone has and downloads what only the account has", () => {
    const plan = planSync({
      ...base,
      local: { board: "a" },
      cloud: { streak: "s" },
    });
    expect(plan.actions).toEqual({ board: "upload", streak: "download" });
    expect(plan.writes).toEqual({ streak: "s" });
  });

  it("lets the account win on a phone's first sign-in", () => {
    const plan = planSync({
      ...base,
      local: { board: "guest" },
      cloud: { board: "saved" },
    });
    expect(plan.actions.board).toBe("download");
    expect(plan.writes.board).toBe("saved");
  });

  it("uploads the phone's newer copy once it is already syncing for the account", () => {
    const plan = planSync({
      ...base,
      alreadySyncing: true,
      local: { board: "newer" },
      cloud: { board: "older" },
    });
    expect(plan.actions.board).toBe("upload");
    expect(plan.writes).toEqual({});
  });

  it("uses progress set aside before accounts only when nothing else has it", () => {
    const plan = planSync({
      ...base,
      legacy: { board: "old", streak: "old" },
      local: {},
      cloud: { streak: "saved" },
    });
    expect(plan.actions).toEqual({ board: "upload", streak: "download" });
    expect(plan.writes).toEqual({ board: "old", streak: "saved" });
  });

  it("does nothing when both agree", () => {
    expect(
      planSync({ ...base, local: { board: "x" }, cloud: { board: "x" } })
        .actions.board,
    ).toBe("none");
  });
});

describe("rows", () => {
  it("round-trip a persisted store exactly", () => {
    const raw = JSON.stringify({ state: { learned: ["a"] }, version: 3 });
    const row = toRow(raw);
    expect(row.version).toBe(3);
    expect(fromRow(row.data)).toBe(raw);
  });
  it("keep a value that is not JSON", () => {
    expect(fromRow(toRow("plain").data)).toBe("plain");
  });
});

describe("sameValue", () => {
  it("treats the database's reordered keys as the same progress", () => {
    expect(sameValue('{"days":4,"best":6}', '{"best":6,"days":4}')).toBe(true);
    expect(sameValue('{"a":{"y":1,"x":2}}', '{"a":{"x":2,"y":1}}')).toBe(true);
  });
  it("still tells different progress apart", () => {
    expect(sameValue('{"days":4}', '{"days":5}')).toBe(false);
    expect(sameValue("[1,2]", "[2,1]")).toBe(false);
  });
  it("keeps a reordered copy from looking like a change on sync", () => {
    const plan = planSync({
      stores: ["streak"],
      local: { streak: '{"days":4,"best":6}' },
      cloud: { streak: '{"best":6,"days":4}' },
      legacy: {},
      alreadySyncing: true,
    });
    expect(plan.actions.streak).toBe("none");
  });
});
