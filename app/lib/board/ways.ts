/**
 * Every correct way from one place to another, not just the one the route
 * rules pick.
 *
 * A learner can often get to the green box more than one way without breaking
 * a rule: a later gap in the central reserve, another lane option round the
 * roundabout, the street instead of the roundabout. The route rules
 * (`planRoute`) still pick one of them as the answer. The others are correct
 * but longer: they pass, a star down. A way that cuts through the parking area
 * when another way does not is wrong under Rule 3, and only ever shown.
 *
 * The search branches on the moves that make a way different: which lane
 * option is taken onto the roundabout, which exit, which junction turn, which
 * gap, which bay. It never branches on where a lane change happens, so two
 * ways that differ only in that are one way.
 */
import {
  type Maneuver,
  type NetEdge,
  network,
  type Plan,
  planRoute,
  type Route,
  routeOf,
  shortest,
} from "./network";

/**
 * - `answer`: the way the route rules pick.
 * - `also`: another correct way that is no longer, or the answer's own way
 *   through the board in another lane its lane options allow. A full pass.
 * - `longer`: a correct way that is clearly longer. It passes, a star down.
 * - `wrong_parking`: through the parking area when another way is not. Only
 *   ever shown, as the wrong answer.
 */
export type WayKind = "answer" | "also" | "longer" | "wrong_parking";

export type Way = {
  route: Route;
  kind: WayKind;
  /** The moves that make it this way and no other, lanes and all. */
  signature: string;
  /**
   * Its way through the board: the turns, exits, gaps and bays, leaving out
   * which lane. Ways with the same shape are shown once.
   */
  shape: string;
};

/** The moves that tell one way from another. */
const KEY: ReadonlySet<Maneuver> = new Set<Maneuver>([
  "hold_lane",
  "exit",
  "turn_left",
  "turn_right",
  "u_turn",
  "park_forward",
  "park_reverse",
  "leave_forward",
  "leave_reverse",
]);

export function signatureOf(edges: readonly NetEdge[]): string {
  return edges
    .filter((e) => KEY.has(e.maneuver))
    .map((e) => e.id)
    .join(" > ");
}

/**
 * The way through the board, whatever the lane. A lane option onto the
 * roundabout is its road and turn (`rb:S2:straight:on` is `S:straight`), and
 * a junction turn or a gap is its node ids with the lane numbers taken out.
 */
export function shapeOf(edges: readonly NetEdge[]): string {
  const moves: string[] = [];
  for (const e of edges) {
    if (!KEY.has(e.maneuver) || e.maneuver === "exit") continue;
    if (e.maneuver === "hold_lane") {
      const m = /rb:([SWNE])\d+:([a-z]+)/.exec(e.id);
      moves.push(m ? `${m[1]}:${m[2]}` : e.id);
      continue;
    }
    moves.push(e.id.replace(/:(in|out):\d+@/g, ":$1@"));
  }
  return moves.join(" > ");
}

/** A way this much longer than the answer, or more, costs a star. */
export const LONGER_BY = 10;

/** A way longer than this is not worth showing, nor something a learner meant. */
export function wayLimit(answer: number): number {
  return Math.max(answer * 2, answer + 160);
}
/** How many ways are shown at most, the answer included. */
export const MAX_SHOWN = 5;
/** How many ways a drive is judged against at most, lane by lane. */
const MAX_WAYS = 16;
/** How deep the search goes: ways that differ from the answer in up to this many moves. */
const DEPTH = 3;
/** How many route searches one place-to-place may cost. */
const BUDGET = 120;

export type Ways = {
  plan: Plan;
  /**
   * The answer first, then the other correct ways, shortest first, then the
   * wrong one through the parking area.
   */
  ways: Way[];
};

/**
 * The answer, every other correct way, and the way through the parking area
 * when that is wrong. The other ways never use a connection a driving school
 * still has to confirm.
 */
export function findWays(
  from: string,
  to: string,
  arrive?: Maneuver,
  avoid?: ReadonlySet<NetEdge>,
): Ways {
  const plan = planRoute(from, to, arrive, avoid);
  const answer = plan.route;
  if (!answer) return { plan, ways: [] };
  const parking = plan.rule === "parking" || plan.rule === "last_resort";
  const closed = new Set<NetEdge>(avoid ?? []);
  for (const e of network().edges) if (!e.confirmed) closed.add(e);
  const limit = wayLimit(answer.length);

  const first = signatureOf(answer.edges);
  const seen = new Set([first]);
  const found: { edges: NetEdge[]; length: number; signature: string }[] = [];
  const queue: { edges: NetEdge[]; shut: Set<NetEdge>; depth: number }[] = [
    { edges: answer.edges, shut: closed, depth: 0 },
  ];
  let budget = BUDGET;
  while (queue.length > 0 && budget > 0) {
    const { edges, shut, depth } = queue.shift() as (typeof queue)[number];
    if (depth >= DEPTH) continue;
    for (const key of edges) {
      if (!KEY.has(key.maneuver) || shut.has(key)) continue;
      if (budget <= 0) break;
      budget -= 1;
      const without = new Set(shut);
      without.add(key);
      const way = shortest(from, to, parking, arrive, without);
      if (!way) continue;
      const signature = signatureOf(way);
      if (seen.has(signature)) continue;
      seen.add(signature);
      const length = way.reduce((sum, e) => sum + e.length, 0);
      if (length > limit) continue;
      found.push({ edges: way, length, signature });
      queue.push({ edges: way, shut: without, depth: depth + 1 });
    }
  }

  found.sort((a, b) => a.length - b.length);
  const home = shapeOf(answer.edges);
  const ways: Way[] = [
    { route: answer, kind: "answer", signature: first, shape: home },
    ...found.slice(0, MAX_WAYS - 1).map((one): Way => {
      const shape = shapeOf(one.edges);
      return {
        route: routeOf(one.edges),
        kind:
          shape === home || one.length < answer.length + LONGER_BY
            ? "also"
            : "longer",
        signature: one.signature,
        shape,
      };
    }),
  ];
  if (plan.shortcut) {
    ways.push({
      route: plan.shortcut,
      kind: "wrong_parking",
      signature: signatureOf(plan.shortcut.edges),
      shape: shapeOf(plan.shortcut.edges),
    });
  }
  return { plan, ways };
}

/** The ways a drive may pass by: the answer and the other correct ones. */
export function accepted(ways: readonly Way[]): Way[] {
  return ways.filter((one) => one.kind !== "wrong_parking");
}

/**
 * The ways worth showing a learner: one for each way through the board, the
 * answer first, so the same way in another lane is not shown twice.
 */
export function shownWays(ways: readonly Way[]): Way[] {
  const shapes = new Set<string>();
  const shown: Way[] = [];
  for (const one of ways) {
    if (shapes.has(one.shape)) continue;
    shapes.add(one.shape);
    shown.push(one);
  }
  const wrong = shown.filter((one) => one.kind === "wrong_parking");
  return [
    ...shown.filter((one) => one.kind !== "wrong_parking").slice(0, MAX_SHOWN),
    ...wrong,
  ];
}
