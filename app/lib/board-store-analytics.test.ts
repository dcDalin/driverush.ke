import { beforeEach, describe, expect, it, vi } from "vitest";

const sent = vi.hoisted(() => [] as { name: string; args: unknown }[]);

vi.mock("./analytics", () => ({
  analytics: new Proxy(
    {},
    {
      get: (_, name: string) => (args: unknown) => sent.push({ name, args }),
    },
  ),
}));
vi.mock("./sounds", () => ({
  BUZZ: {},
  buzz: () => {},
  playSfx: () => {},
  stopAllSfx: () => {},
  warmSfx: () => {},
}));

const { useBoardStore } = await import("./board-store");

describe("board store analytics", () => {
  beforeEach(() => {
    sent.length = 0;
  });

  it("reports a changed setting once, and not the first-drive tips", () => {
    const { setSetting } = useBoardStore.getState();
    setSetting({ assist: false });
    setSetting({ assist: false });
    setSetting({ coached: true });
    setSetting({ quality: "low", sound: true });
    expect(sent.filter((e) => e.name === "boardSettingChanged")).toEqual([
      {
        name: "boardSettingChanged",
        args: { setting: "assist", value: "false" },
      },
      {
        name: "boardSettingChanged",
        args: { setting: "quality", value: "low" },
      },
    ]);
  });

  it("marks a round with no tasks asked for as the mock test", () => {
    const { start } = useBoardStore.getState();
    start();
    const round = sent.find((e) => e.name === "boardStarted");
    expect(round?.args).toMatchObject({ scope: "round", mock: true });
    sent.length = 0;
    const one = useBoardStore.getState().queue[0]!.id;
    start([one]);
    expect(sent.find((e) => e.name === "boardStarted")?.args).toMatchObject({
      scope: "drill",
      mock: false,
      challenges: 1,
    });
  });

  it("says whether a finished mock test beat the best one", () => {
    const finish = (best: number | undefined, clean: number) => {
      sent.length = 0;
      const queue = useBoardStore.getState().queue;
      useBoardStore.setState({
        round: true,
        phase: "passed",
        pos: queue.length - 1,
        runClean: queue.slice(0, clean).map((c) => c.id),
        mockBest:
          best == null
            ? undefined
            : { clean: best, total: 5, day: "2026-11-20" },
      });
      useBoardStore.getState().next();
      return sent.find((e) => e.name === "boardCompleted")?.args;
    };
    useBoardStore.getState().start();
    expect(finish(undefined, 2)).toMatchObject({
      mock: true,
      best_before: 0,
      new_best: true,
    });
    expect(finish(3, 2)).toMatchObject({ best_before: 3, new_best: false });
    expect(finish(3, 4)).toMatchObject({ best_before: 3, new_best: true });
  });

  it("reports a free drive started and ended, and never as abandoned", () => {
    const { freeDrive } = useBoardStore.getState();
    freeDrive("course_page");
    expect(sent.find((e) => e.name === "boardFreeDriveStarted")?.args).toEqual({
      surface: "course_page",
    });
    useBoardStore.getState().exit();
    const ended = sent.find((e) => e.name === "boardFreeDriveEnded");
    expect(ended?.args).toMatchObject({
      rules_broken: 0,
      set_backs: 0,
      rules: "",
      moved: false,
    });
    expect(sent.some((e) => e.name === "boardAbandoned")).toBe(false);
    expect(sent.some((e) => e.name === "boardFaulted")).toBe(false);
  });
});
