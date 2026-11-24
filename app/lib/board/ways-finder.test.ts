/**
 * The level finder: runs only with FIND=1. It sweeps every start and end on
 * the board against every block, alone and in pairs, and prints the drives
 * that leave the learner one way only: through the parking area (Rule 3), the
 * long way round (Rule 2), or one way through the board.
 *
 *   FIND=1 npx vitest run app/lib/board/ways-finder.test.ts
 */
import { describe, it } from "vitest";

import { blocks, closedEdges } from "./blocks";
import { network, type NetEdge } from "./network";
import { accepted, findWays, shownWays } from "./ways";

const run = process.env.FIND ? describe : describe.skip;

run("levels with only one way", () => {
  it("prints the candidates", { timeout: 300_000 }, () => {
    const places = network().places.filter((p) => p.group === "road");
    const starts = places.filter((p) => p.starts);
    const ends = places.filter((p) => p.ends);
    const unsure = network().edges.filter((e) => !e.confirmed);
    const sets: { name: string; closed: Set<NetEdge> }[] = [];
    const all = blocks();
    for (const a of all) {
      sets.push({ name: a.id, closed: new Set(closedEdges(a)) });
      for (const b of all) {
        if (b.id <= a.id) continue;
        sets.push({
          name: `${a.id}+${b.id}`,
          closed: new Set([...closedEdges(a), ...closedEdges(b)]),
        });
      }
    }
    const rows: string[] = [];
    const seenRows = new Set<string>();
    for (const set of sets) {
      for (const e of unsure) set.closed.add(e);
      for (const from of starts) {
        for (const to of ends) {
          if (from.id === to.id) continue;
          const open = findWays(from.id, to.id);
          if (!open.plan.route) continue;
          const { plan, ways } = findWays(
            from.id,
            to.id,
            undefined,
            set.closed,
          );
          if (!plan.route) continue;
          const shapes = new Set(accepted(ways).map((w) => w.shape));
          const openShapes = new Set(accepted(open.ways).map((w) => w.shape));
          const changed =
            open.plan.route.edges.map((e) => e.id).join() !==
            plan.route.edges.map((e) => e.id).join();
          if (!changed) continue;
          const kind =
            plan.rule === "last_resort"
              ? "RULE3"
              : shapes.size === 1 && plan.rule === "longest"
                ? "RULE2-ONE"
                : shapes.size === 1
                  ? "ONE"
                  : null;
          if (!kind) continue;
          const said = (route: NonNullable<typeof plan.route>) =>
            route.steps
              .filter(
                (s) =>
                  !["follow", "lane_change", "ring", "exit"].includes(
                    s.maneuver,
                  ),
              )
              .map((s) => s.title)
              .join(" | ");
          // one row per drive: the end lane rarely changes the way
          const key = `${kind}|${set.name}|${from.label}|${to.label.replace(/, lane \d$/, "")}`;
          if (seenRows.has(key)) continue;
          seenRows.add(key);
          rows.push(
            `${kind}\t${set.name}\t${from.label} -> ${to.label}\t${Math.round(plan.route.length)}m (open ${Math.round(open.plan.route.length)}m, ${openShapes.size} ways)\n    NOW:  ${said(shownWays(ways)[0].route)}\n    OPEN: ${said(open.plan.route)}`,
          );
        }
      }
    }
    rows.sort();
    console.log(rows.join("\n"));
    console.log(`\n${rows.length} candidates`);
  });
});
