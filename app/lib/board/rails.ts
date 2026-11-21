/**
 * Lane assist, as paths. Every legal way to drive the board is already a line
 * in the lane network (`network.ts`): each lane, each roundabout option round
 * its ring lane and out into its exit lane, each turn and each gap. The assist
 * keeps track of where on that network the car is, lays out the few paths it
 * could take from here, and follows the one the thumb points along.
 *
 * "Points along" is judged the way a person points: at somewhere a little way
 * ahead. Each path is looked at from the car at several distances, and the
 * closest any of them comes to the knob is that path's score. So a thumb
 * pointing at the exit road picks the exit, a thumb pointing across a tight
 * bend picks the bend, and a thumb pointing 15 degrees over toward the next
 * lane picks that lane. The old assist compared the knob with the lane's
 * direction where the car was, which a person pointing ahead rarely matches,
 * and then let go suddenly.
 *
 * The chosen path is kept unless another clearly fits better for a moment,
 * so a wobble does not swap them. When no path fits at all, the thumb has the
 * car (the joystick decides; the referee judges), and the assist takes it back
 * as soon as the thumb points along a path again.
 *
 * Lane changes are made here rather than taken from the network, so one can
 * start anywhere the lines are broken, not only at the network's nodes.
 *
 * Pure. Run once per physics step.
 */
import { CAR, type CarState } from "./car";
import {
  ARMS,
  ARM_ORDER,
  RING_OUTER_R,
  SOLID_ZONE,
  bearingOf,
  laneBearing,
  lanePoint,
  locate,
  ringRadius,
  turnBetween,
  wrapPi,
  type ArmId,
  type Vec,
} from "./geometry";
import { network, type NetEdge } from "./network";

const DEG = Math.PI / 180;

/** How far ahead the paths are laid out, metres. */
const HORIZON = 30;
/** The distances a path is looked at from the car, metres. */
const LOOKS = [4, 7, 11, 16, 22] as const;
/**
 * A lane change is asked for by leaning the knob toward the lane beside, by
 * this much or more off the way the lane runs a few metres on: 10 degrees is
 * a sloppy thumb, 15 is a lean.
 */
const CHANGE_FROM = 12 * DEG;
/** Up to this: further over is the thumb's, not a change (`FREE_AT`). */
const CHANGE_TO = 38 * DEG;
/** Where the lane's way is read, metres on. */
const CHANGE_AHEAD = 7;
/** Held for this long, so a wobble is not a request. */
const CHANGE_TIME = 0.4;
/** The path being followed counts as this much better fitting than it is. */
const STICKY = 7 * DEG;
/** Another path has to fit better for this long before it is taken. */
const SWITCH_TIME = 0.15;
/**
 * A lane change is asked for by the knob smoothed over this long, seconds,
 * so a shake about one way asks for nothing. The other paths, and letting go
 * to the thumb, go by the knob as it is: a tight exit leaves no time to wait.
 */
const SMOOTH_TIME = 0.25;
/** No path within this of the knob, for `FREE_TIME`: the thumb has the car. */
const FREE_AT = 38 * DEG;
const FREE_TIME = 0.2;
/** And the assist takes it back once a path is within this. */
const BACK_AT = 26 * DEG;
/**
 * On the roundabout, a thumb held still while the ring bends soon points
 * outward of it. That is a lagging thumb, not a request: leaving the ring
 * between exits only crosses its lanes. So it takes the car outward only
 * pointing down an exit road close by, or this far off every path.
 */
const RING_LAG = 62 * DEG;
/** An exit is close when its mouth is within this of the car, metres. */
const EXIT_NEAR = 24;
/** The knob must point within this of the way the exit road runs. */
const EXIT_CONE = 50 * DEG;
/** And this far outward of the way the ring runs, to be asking. */
const EXIT_OUTWARD = 10 * DEG;
/** An exit mouth this far round behind the car is still one it can take. */
const EXIT_PAST = 25 * DEG;
/** The car is on a path while this close to its line, metres. */
const ON_PATH = 1.8;
/** Further than this from the path being followed, it has lost it, metres. */
const LOST = 3;
/** This far off its path, the car is looked for on the lanes beside, metres. */
const ADOPT_FROM = 1;
/** And taken to be on one of them once that much nearer to its line. */
const ADOPT_GAIN = 0.5;
/** Or this, while moving over a lane, a lane's width off its new line. */
const LOST_CHANGING = 5;
/** And it has lost it once facing this far off the path's way. */
const LOST_TURN = 75 * DEG;
/** A lane change ends this far on from where it starts, metres. */
const CHANGE_LENGTH = 8;
/** Room a change needs before the continuous lines at the roundabout, metres. */
const CHANGE_ROOM = 5;
/** A lane change starts only from within this of the middle of a lane, metres. */
const SETTLED = 0.9;
/** And with the car running this close to the lane's way. */
const SQUARE = 25 * DEG;
/** Sideways grip the assist drives within on a bend, m/s². */
const BEND_GRIP = 3.2;
/** The slow speed down the parking aisle, metres a second. */
export const AISLE_SPEED = 4;
/**
 * A car this far behind, or this far ahead, keeps a lane change out of its
 * lane. The other cars on the table stand still: moving over in front of one
 * only means stopping behind it.
 */
const CLEAR_BEHIND = CAR.length + 1;
const CLEAR_AHEAD = 20;
/** A path that leaves the task's exit lane is this much less likely. */
const NOT_THE_TASK = 12 * DEG;
/**
 * Going on round the ring lane past every exit its option allows: wrong for
 * that lane, but the learner's to choose (the referee judges). This much
 * less likely than a way the lane may go, so it is only taken on purpose.
 */
const ROUND_AGAIN = 10 * DEG;
/** Pointing in across the island, up to this far in: a thumb following the bend. */
const INWARD = 100 * DEG;
/** On a tight bend the car aims no further ahead than this share of its radius. */
const BEND_REACH = 0.33;

/** How the learner is asking, besides the knob. */
export type Ask =
  /** A thumb, or keys turning: the path the knob points along. */
  | "point"
  /** The up arrow alone: carry on along the road, never letting go. */
  | "follow"
  /** The left arrow on the roundabout: the next exit. */
  | "exit"
  /** Left or right tapped: the lane beside, that way (`side`). */
  | "change";

export type RailsState = {
  /** The edge the car is on, and how far along it. Null off the network. */
  edge: string | null;
  s: number;
  /** The edges of the path being followed, from `edge` on. */
  plan: string[];
  /** The road the car came up to the roundabout, and its lane. */
  entry: { arm: ArmId; lane: number } | null;
  /** A path that fits better than the plan, and for how long it has. */
  rival: string | null;
  rivalFor: number;
  /** Seconds no path has fitted, and whether the thumb has the car. */
  misfit: number;
  free: boolean;
  /** The knob smoothed over `SMOOTH_TIME`, as a unit vector. Null let go. */
  steadyX: number | null;
  steadyZ: number | null;
  /** Moving over into the lane beside: still a lane's width off its line. */
  changing: boolean;
};

export function createRails(): RailsState {
  return {
    edge: null,
    s: 0,
    plan: [],
    entry: null,
    rival: null,
    rivalFor: 0,
    misfit: 0,
    free: false,
    steadyX: null,
    steadyZ: null,
    changing: false,
  };
}

/** What the assist decided this step. */
export type Steer = {
  /** The way to steer. */
  heading: number;
  /** The fastest to go here, for the bends ahead. */
  cap: number;
  /** Where on the path it is aiming, and which way the path runs there. */
  aim: Vec;
  along: number;
  /** The lane the path is in, on one of the roundabout's roads. For tests. */
  lane: number | null;
  /** The path ahead, a point a metre, for the scene to draw. */
  path: Vec[];
};

// ---- the network, measured ---------------------------------------------------------

type Measured = {
  edge: NetEdge;
  /** How far along the edge each point is. */
  at: number[];
};

const measured = new Map<string, Measured>();

function measure(edge: NetEdge): Measured {
  let m = measured.get(edge.id);
  if (!m) {
    const at = [0];
    for (let i = 1; i < edge.points.length; i += 1) {
      const a = edge.points[i - 1];
      const b = edge.points[i];
      at.push(at[i - 1] + Math.hypot(b.x - a.x, b.z - a.z));
    }
    m = { edge, at };
    measured.set(edge.id, m);
  }
  return m;
}

function edgeLength(edge: NetEdge): number {
  const m = measure(edge);
  return m.at[m.at.length - 1];
}

/** The point `s` metres along an edge, and the way the edge runs there. */
function pointOn(
  edge: NetEdge,
  s: number,
): { x: number; z: number; h: number } {
  const { at } = measure(edge);
  const pts = edge.points;
  const d = Math.max(0, Math.min(at[at.length - 1], s));
  let lo = 0;
  let hi = at.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (at[mid] <= d) lo = mid;
    else hi = mid;
  }
  const a = pts[lo];
  const b = pts[hi] ?? a;
  const span = at[hi] - at[lo];
  const t = span > 0 ? (d - at[lo]) / span : 0;
  return {
    x: a.x + (b.x - a.x) * t,
    z: a.z + (b.z - a.z) * t,
    h: bearingOf(b.x - a.x, b.z - a.z),
  };
}

/** Where on an edge a point is nearest: how far along, and how far off. */
function project(
  edge: NetEdge,
  p: Vec,
  near?: number,
): { s: number; off: number; h: number } {
  const { at } = measure(edge);
  const pts = edge.points;
  let best = { s: 0, off: Infinity, h: 0 };
  for (let i = 0; i < pts.length - 1; i += 1) {
    // looking only near where it was, when told
    if (near != null && (at[i + 1] < near - 6 || at[i] > near + 6)) continue;
    const a = pts[i];
    const b = pts[i + 1];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const span = dx * dx + dz * dz;
    const t =
      span > 0
        ? Math.min(1, Math.max(0, ((p.x - a.x) * dx + (p.z - a.z) * dz) / span))
        : 0;
    const off = Math.hypot(a.x + dx * t - p.x, a.z + dz * t - p.z);
    if (off < best.off) {
      best = { s: at[i] + (at[i + 1] - at[i]) * t, off, h: bearingOf(dx, dz) };
    }
  }
  return best;
}

/** Edges a car may drive forward on with the assist: not into or out of bays. */
function drivable(edge: NetEdge): boolean {
  return (
    edge.gear === "forward" &&
    edge.maneuver !== "lane_change" &&
    edge.maneuver !== "park_forward" &&
    edge.maneuver !== "park_reverse" &&
    edge.maneuver !== "leave_forward" &&
    edge.maneuver !== "leave_reverse"
  );
}

function byId(id: string): NetEdge | undefined {
  return index().byId.get(id);
}

type Index = {
  byId: Map<string, NetEdge>;
  drivable: NetEdge[];
  /** The lanes of the roundabout's roads: "S:in:2" to its follow edges. */
  lanes: Map<string, NetEdge[]>;
};

let built: Index | null = null;

function index(): Index {
  if (built) return built;
  const net = network();
  const byId = new Map<string, NetEdge>();
  const lanes = new Map<string, NetEdge[]>();
  for (const edge of net.edges) {
    byId.set(edge.id, edge);
    const key = laneKey(edge);
    if (key && edge.maneuver === "follow") {
      const list = lanes.get(key) ?? [];
      list.push(edge);
      lanes.set(key, list);
    }
  }
  built = { byId, drivable: net.edges.filter(drivable), lanes };
  return built;
}

/** "S:in:2" for an edge along lane 2 of the road coming in from the south. */
function laneKey(edge: NetEdge): string | null {
  const m = /^([NSEW]):(in|out):(\d)@[\d.]+>\1:\2:\3@/.exec(edge.id);
  return m ? `${m[1]}:${m[2]}:${m[3]}` : null;
}

function parseLane(key: string): {
  arm: ArmId;
  side: "in" | "out";
  lane: number;
} {
  const [arm, side, lane] = key.split(":");
  return { arm: arm as ArmId, side: side as "in" | "out", lane: Number(lane) };
}

function successors(edge: NetEdge): NetEdge[] {
  return (network().out.get(edge.to) ?? []).filter(drivable);
}

/**
 * Ring paths of one roundabout option run together until each turns off.
 * Those of the lane the car came in by are all still open to it.
 */
function siblings(edge: NetEdge, entry: RailsState["entry"]): NetEdge[] {
  if (edge.maneuver === "ring") {
    const m = /^rb:([NSEW])(\d):/.exec(edge.id);
    const prefix = entry
      ? `rb:${entry.arm}${entry.lane}:`
      : m
        ? `rb:${m[1]}${m[2]}:`
        : null;
    if (!prefix) return [edge];
    return index().drivable.filter(
      (e) => e.maneuver === "ring" && e.id.startsWith(prefix),
    );
  }
  if (edge.maneuver === "hold_lane") {
    // the last stretch before the ring: one edge per option, side by side
    return (network().out.get(edge.from) ?? []).filter(
      (e) => e.maneuver === "hold_lane",
    );
  }
  return [edge];
}

// ---- where the car is -----------------------------------------------------------

/** Find the car on the network afresh: the nearest edge it is on and facing along. */
function findCar(
  car: CarState,
  entry: RailsState["entry"],
): {
  edge: NetEdge;
  s: number;
} | null {
  let best: { edge: NetEdge; s: number; score: number } | null = null;
  for (const edge of index().drivable) {
    if (entry && edge.maneuver === "ring") {
      if (!edge.id.startsWith(`rb:${entry.arm}${entry.lane}:`)) continue;
    }
    const at = project(edge, car);
    if (at.off > ON_PATH) continue;
    const turn = Math.abs(wrapPi(at.h - car.heading));
    if (turn > 50 * DEG) continue;
    // plain lanes before the rest, where several lie on top of each other
    const kind = edge.maneuver === "follow" ? 0 : 0.3;
    const score = at.off + turn * 2 + kind;
    if (!best || score < best.score) best = { edge, s: at.s, score };
  }
  return best ? { edge: best.edge, s: best.s } : null;
}

/** Move the car's place on the network on, as it drives. */
function trackCar(state: RailsState, car: CarState): NetEdge | null {
  let edge = state.edge ? byId(state.edge) : undefined;
  if (edge) {
    let at = project(edge, car, state.s);
    // run on into the next edge of the plan, or the nearest that follows
    let hops = 0;
    while (at.s >= edgeLength(edge) - 0.01 && hops < 4) {
      hops += 1;
      const here: NetEdge = edge;
      const next: NetEdge | undefined =
        state.plan[1] && state.plan[0] === here.id
          ? byId(state.plan[1])
          : undefined;
      const options: NetEdge[] = next ? [next] : successors(here);
      let pick: { edge: NetEdge; at: ReturnType<typeof project> } | null = null;
      for (const one of options) {
        const there: ReturnType<typeof project> = project(one, car, 0);
        if (!pick || there.off < pick.at.off) pick = { edge: one, at: there };
      }
      if (!pick) break;
      if (state.plan[0] === edge.id) state.plan = state.plan.slice(1);
      edge = pick.edge;
      at = pick.at;
    }
    if (state.changing && at.off < SETTLED) state.changing = false;
    // The thumb may have moved the car into another lane by itself. Then that
    // lane is the car's: never pull it back over into the one it left.
    // Only between plain lanes: on the ring and its exits several ways lie
    // over each other, and the car crossing them is not changing its mind.
    if (!state.changing && at.off > ADOPT_FROM && edge.maneuver === "follow") {
      const there = findCar(car, null);
      if (
        there &&
        there.edge.id !== edge.id &&
        there.edge.maneuver === "follow"
      ) {
        const off = project(there.edge, car, there.s).off;
        if (off < at.off - ADOPT_GAIN) {
          state.edge = there.edge.id;
          state.s = there.s;
          state.plan = [there.edge.id];
          noteEntry(state, there.edge);
          return there.edge;
        }
      }
    }
    const lost =
      at.off > (state.changing ? LOST_CHANGING : LOST) ||
      Math.abs(wrapPi(at.h - car.heading)) > LOST_TURN;
    if (!lost) {
      state.edge = edge.id;
      state.s = at.s;
      noteEntry(state, edge);
      return edge;
    }
  }
  state.changing = false;
  const found = findCar(car, onRing(car) ? state.entry : null);
  state.edge = found?.edge.id ?? null;
  state.s = found?.s ?? 0;
  state.plan = found ? [found.edge.id] : [];
  if (found) noteEntry(state, found.edge);
  return found?.edge ?? null;
}

function onRing(car: CarState): boolean {
  return locate(car.x, car.z).kind === "ring";
}

/** Coming up a road to the roundabout, remember which road and lane. */
function noteEntry(state: RailsState, edge: NetEdge): void {
  const key = laneKey(edge);
  if (key) {
    const lane = parseLane(key);
    state.entry =
      lane.side === "in" ? { arm: lane.arm, lane: lane.lane } : null;
    return;
  }
  const m = /^([NSEW]):in:(\d)@/.exec(edge.id);
  if (edge.maneuver === "hold_lane" && m) {
    state.entry = { arm: m[1] as ArmId, lane: Number(m[2]) };
  }
}

// ---- the paths ahead -----------------------------------------------------------

type Path = {
  /** The edges, the first one entered `s0` along. */
  edges: NetEdge[];
  s0: number;
  key: string;
  /** A point a metre from the car's place on, and how far along each is. */
  points: { x: number; z: number; h: number }[];
  /** Made here: a change into the lane beside. */
  change: boolean;
  /** Which side that lane is on: -1 left, 1 right. */
  side?: number;
  /** How far before it turns off the road it is on: an exit, a turn, a change. */
  stays: number;
  /** The exit it leaves the roundabout by, and into which lane. */
  exit: { arm: ArmId; lane: number; ahead: number } | null;
};

function layOut(edges: NetEdge[], s0: number, change: boolean): Path {
  const points: Path["points"] = [];
  let left = HORIZON;
  let stays = change ? 0 : Infinity;
  let exit: Path["exit"] = null;
  let gone = 0;
  edges.forEach((edge, k) => {
    const from = k === 0 ? s0 : 0;
    const length = edgeLength(edge);
    if (
      stays === Infinity &&
      (edge.maneuver === "exit" ||
        edge.maneuver === "turn_left" ||
        edge.maneuver === "turn_right" ||
        edge.maneuver === "u_turn")
    ) {
      stays = gone;
    }
    if (!exit && edge.maneuver === "exit") {
      const m = /^([NSEW]):out:(\d)@/.exec(edge.to);
      if (m) exit = { arm: m[1] as ArmId, lane: Number(m[2]), ahead: gone };
    }
    for (let s = from; s <= length && left > 0; s += 1) {
      points.push(onLane(edge, pointOn(edge, s)));
      left -= 1;
    }
    gone += length - from;
  });
  return {
    edges,
    s0,
    key: (change ? "~" : "") + edges.map((e) => e.id).join("|"),
    points,
    change,
    stays,
    exit,
  };
}

/**
 * On the roundabout: on round the ring lane the car is in, whatever its
 * option. Not a path of the network: the way a learner going round again,
 * rightly or wrongly, would go.
 */
function roundAgain(
  car: CarState,
  edge: NetEdge | null,
  plan: string[],
): Path | null {
  const loc = locate(car.x, car.z);
  if (loc.kind !== "ring") return null;
  // the ring lane it is going round in, not one it is wobbling over into
  const going = /^round:(\d)$/.exec(plan[0] ?? "");
  const lane =
    edge?.maneuver === "ring" && edge.lane
      ? edge.lane
      : going
        ? Number(going[1])
        : loc.lane;
  const r = ringRadius(lane);
  const points: Path["points"] = [];
  for (let d = 0; d <= HORIZON; d += 1) {
    // clockwise: the bearing grows going round
    const b = loc.bearing + d / r;
    points.push({
      x: Math.sin(b) * r,
      z: -Math.cos(b) * r,
      h: b + Math.PI / 2,
    });
  }
  return {
    edges: [],
    s0: 0,
    key: `round:${lane}`,
    points,
    change: false,
    stays: Infinity,
    exit: null,
  };
}

/** Round the ring, a path within this of its lane's middle is steered on it, metres. */
const RING_SNAP = 0.6;

/**
 * On the ring, the middle of the lane. The network's ring paths ease into
 * their lane from the entry and sit a little off its middle in places; the
 * assist steers for the middle wherever the path is already close to it.
 */
function onLane(
  edge: NetEdge,
  p: { x: number; z: number; h: number },
): { x: number; z: number; h: number } {
  if (edge.maneuver !== "ring" || !edge.lane) return p;
  const r = Math.hypot(p.x, p.z);
  const want = ringRadius(edge.lane);
  const k = Math.max(
    0,
    Math.min(1, (RING_SNAP - Math.abs(r - want)) / RING_SNAP),
  );
  if (k === 0 || r < 1e-6) return p;
  const to = r + (want - r) * k;
  return { x: (p.x / r) * to, z: (p.z / r) * to, h: p.h };
}

/** Every way on from `edge`, `s` along it, to `HORIZON` metres. */
function pathsFrom(edge: NetEdge, s: number, change: boolean): Path[] {
  const out: Path[] = [];
  const walk = (chain: NetEdge[], budget: number) => {
    const last = chain[chain.length - 1];
    const rest = edgeLength(last) - (chain.length === 1 ? s : 0);
    if (rest >= budget || out.length >= 24) {
      out.push(layOut(chain, s, change));
      return;
    }
    const next = successors(last);
    if (!next.length) {
      out.push(layOut(chain, s, change));
      return;
    }
    for (const one of next) walk([...chain, one], budget - rest);
  };
  walk([edge], HORIZON);
  return out;
}

/** Is a car standing in this lane alongside or just ahead? */
function laneTaken(
  arm: ArmId,
  side: "approach" | "exit",
  along: number,
  lane: number,
  others: readonly { x: number; z: number }[],
): boolean {
  const ahead = side === "approach" ? -1 : 1;
  return others.some((other) => {
    const at = locate(other.x, other.z);
    if (at.kind !== "arm" || at.arm !== arm || at.side !== side) return false;
    if (at.lane !== lane) return false;
    const gap = (at.along - along) * ahead;
    return gap > -CLEAR_BEHIND && gap < CLEAR_AHEAD;
  });
}

/** Into the lane beside, where the lines are broken and it is clear. */
function changes(
  car: CarState,
  edge: NetEdge,
  s: number,
  others: readonly { x: number; z: number }[],
): Path[] {
  const key = laneKey(edge);
  if (!key) return [];
  const { arm, side, lane } = parseLane(key);
  const at = project(edge, car, s);
  if (at.off > SETTLED) return [];
  if (Math.abs(wrapPi(car.heading - at.h)) > SQUARE) return [];
  const loc = locate(car.x, car.z);
  if (loc.kind !== "arm") return [];
  const way = side === "in" ? "approach" : "exit";
  // the change crosses the line about halfway over: it must be done by then
  const room =
    way === "approach"
      ? loc.along - CHANGE_ROOM > SOLID_ZONE
      : loc.along > SOLID_ZONE + 1;
  if (!room) return [];
  const out: Path[] = [];
  for (const to of [lane - 1, lane + 1]) {
    if (to < 1 || to > ARMS[arm].lanes) continue;
    if (laneTaken(arm, way, loc.along, to, others)) continue;
    const there = pointOn(edge, s + CHANGE_LENGTH);
    let into: { edge: NetEdge; s: number; off: number } | null = null;
    for (const one of index().lanes.get(`${arm}:${side}:${to}`) ?? []) {
      const p = project(one, there);
      if (!into || p.off < into.off) into = { edge: one, s: p.s, off: p.off };
    }
    // the lane beside lies a lane's width over: anything further is not it
    if (!into || into.off > 6) continue;
    // from the car's place across to the lane beside, then on along it
    const from = project(into.edge, car);
    // seen from the car, is the lane beside to its left or right? Bearings
    // grow clockwise, so right of the way `h` is the direction h + 90°.
    const beside = pointOn(into.edge, from.s);
    const across =
      (beside.x - car.x) * Math.cos(at.h) + (beside.z - car.z) * Math.sin(at.h);
    for (const path of pathsFrom(into.edge, from.s, true)) {
      out.push({ ...path, side: Math.sign(across) || 1 });
    }
  }
  return out;
}

// ---- choosing ----------------------------------------------------------------------

/** How far off the knob a path is: the closest it comes, looked at from the car. */
function misfit(path: Path, car: CarState, knob: number): number {
  let best = Infinity;
  for (const look of LOOKS) {
    const p = path.points[Math.min(path.points.length - 1, look)];
    if (!p) continue;
    if (Math.hypot(p.x - car.x, p.z - car.z) < 2) continue;
    const off = Math.abs(wrapPi(bearingOf(p.x - car.x, p.z - car.z) - knob));
    if (off < best) best = off;
  }
  return best;
}

/** Is this path the one being followed, as far as both run? */
function isPlan(path: Path, plan: string[]): boolean {
  if (!plan.length) return false;
  if (!path.edges.length) return plan[0] === path.key;
  const ids = path.edges.map((e) => e.id);
  const from = plan.indexOf(ids[0]);
  if (from < 0) return false;
  for (let k = 0; k < ids.length && from + k < plan.length; k += 1) {
    if (ids[k] !== plan[from + k]) return false;
  }
  return true;
}

/**
 * Where the assist steers, for a car with the knob pointing `knob` (null: let
 * go). Null when the thumb has the car: off the network, or pointing along no
 * path.
 */
export function rails(
  car: CarState,
  knob: number | null,
  state: RailsState,
  options: {
    ask?: Ask;
    /** For "change": -1 the lane to the left, 1 to the right. */
    side?: number;
    others?: readonly { x: number; z: number }[];
    exitTo?: { arm: ArmId; lane: number } | null;
  } = {},
  step = 1 / 60,
): Steer | null {
  const edge = trackCar(state, car);
  const others = options.others ?? [];
  const ask = options.ask ?? "point";
  let paths: Path[] = [];
  if (edge) {
    for (const one of siblings(edge, state.entry)) {
      const at = one.id === edge.id ? state.s : project(one, car, state.s).s;
      // ring paths that have already turned off are not open any more
      if (one.id !== edge.id && project(one, car, state.s).off > 1) continue;
      paths.push(...pathsFrom(one, at, false));
    }
    if (ask === "point" || ask === "change") {
      paths.push(...changes(car, edge, state.s, others));
    }
  }
  const again = ask === "point" ? roundAgain(car, edge, state.plan) : null;
  if (again) paths.push(again);
  if (!paths.length) {
    state.free = false;
    return null;
  }

  // the plan, as it is laid out now; a change keeps going once begun
  let plan = paths.find((p) => isPlan(p, state.plan)) ?? null;

  if (knob == null) {
    state.steadyX = state.steadyZ = null;
    state.free = false;
    state.misfit = 0;
    // let go: keep to the plan while the car rolls to a stop
    const keep = plan ?? paths[0];
    state.plan = keep.edges.length ? keep.edges.map((e) => e.id) : [keep.key];
    return steerAlong(keep, car);
  }

  let pick: Path;
  if (ask === "follow") {
    // up alone: the path that stays on this road longest, the plan if level
    // (of those going the task's way, where it ends in one lane)
    paths = paths.filter((p) => !p.change);
    const task = paths.filter((p) => fitsTask(p, state.entry, options.exitTo));
    if (task.length) paths = task;
    const longest = Math.max(...paths.map((p) => p.stays));
    const stay = paths.filter((p) => p.stays >= longest - 1);
    pick = stay.find((p) => p === plan) ?? stay[0];
    state.free = false;
  } else if (ask === "change") {
    // keys ask outright: into the lane beside, if there is one to go to
    const over = paths.filter((p) => p.change && p.side === options.side);
    const stay = paths.filter((p) => !p.change);
    pick =
      over[0] ??
      plan ??
      stay.reduce((a, b) => (b.stays > a.stays ? b : a), stay[0] ?? paths[0]);
    state.free = false;
  } else if (ask === "exit") {
    const ours = paths.filter((p) => fitsTask(p, state.entry, options.exitTo));
    const leaving = (ours.some((p) => p.exit) ? ours : paths)
      .filter((p) => p.exit)
      .sort((a, b) => a.exit!.ahead - b.exit!.ahead);
    const first = leaving[0]?.exit?.ahead;
    const soon = leaving.filter((p) => p.exit!.ahead <= (first ?? 0) + 1);
    pick =
      soon.length > 0
        ? soon.reduce((a, b) =>
            misfit(a, car, knob) <= misfit(b, car, knob) ? a : b,
          )
        : (plan ?? paths[0]);
    state.free = false;
  } else {
    const steady = smooth(state, knob, step);
    // the way the lane runs a few metres on, for telling a lean
    // (the way on that stays on this road longest: not a turn or an exit)
    const lane = paths
      .filter((p) => !p.change && p !== again)
      .reduce<Path | null>(
        (best, p) => (!best || p.stays > best.stays ? p : best),
        null,
      );
    const ahead = lane?.points[Math.min(lane.points.length - 1, CHANGE_AHEAD)];
    const runs = ahead ? bearingOf(ahead.x - car.x, ahead.z - car.z) : null;
    const lean = (k: number, side: number) =>
      runs == null ? 0 : wrapPi(k - runs) * side;
    const leans = (k: number, side: number) => {
      const off = lean(k, side);
      return off >= CHANGE_FROM && off <= CHANGE_TO;
    };
    const scored = paths
      .filter((path) => !path.change || leans(steady, path.side ?? 1))
      .map((path) => {
        if (path.change) {
          // leaning toward the lane beside, steadily: that lane, before all
          const now = leans(knob, path.side ?? 1) ? 0 : Infinity;
          return { path, fit: 0, score: -1, now };
        }
        // the rest by the knob as it is: a tight exit leaves no time to wait
        const fit = misfit(path, car, knob);
        let score = fit;
        if (path === plan) score -= STICKY;
        if (!fitsTask(path, state.entry, options.exitTo)) score += NOT_THE_TASK;
        if (path === again) score += ROUND_AGAIN;
        return { path, fit, score, now: fit };
      });
    scored.sort((a, b) => a.score - b.score);
    // nothing fits the knob as it is: after a moment the thumb has the car
    const fits = scored.length
      ? Math.min(...scored.map((one) => one.now))
      : Infinity;
    const limit = freeLimit(car, knob);
    if (state.free) {
      if (fits < BACK_AT && limit !== Infinity) {
        state.free = false;
        state.misfit = 0;
      } else if (limit === Infinity) {
        state.free = false;
        state.misfit = 0;
      }
    } else if (fits > limit) {
      state.misfit += step;
      if (state.misfit >= FREE_TIME) state.free = true;
    } else {
      state.misfit = 0;
    }
    if (state.free || !scored.length) {
      state.rival = null;
      state.rivalFor = 0;
      if (plan) {
        state.plan = plan.edges.length
          ? plan.edges.map((e) => e.id)
          : [plan.key];
      }
      return null;
    }
    const best = scored[0];
    // another path has to fit better for a moment before it is taken
    pick = plan ?? best.path;
    if (!plan) {
      pick = best.path.change
        ? (paths.find((p) => !p.change) ?? best.path)
        : best.path;
    } else if (best.path !== plan) {
      if (state.rival === best.path.key) state.rivalFor += step;
      else {
        state.rival = best.path.key;
        state.rivalFor = step;
      }
      const wait = best.path.change ? CHANGE_TIME : SWITCH_TIME;
      if (state.rivalFor >= wait) pick = best.path;
    } else {
      state.rival = null;
      state.rivalFor = 0;
    }
  }

  if (!pick.edges.length) {
    // round again: the car's place is found afresh on the ring as it goes
    state.plan = [pick.key];
    return steerAlong(pick, car);
  }
  if (pick.edges[0].id !== state.edge) {
    // a path lying alongside (another way round the same ring lane), or the
    // lane beside: the car is now on it
    state.edge = pick.edges[0].id;
    state.s = pick.s0;
    if (pick.change) state.changing = true;
    state.rival = null;
    state.rivalFor = 0;
  }
  state.plan = pick.edges.map((e) => e.id);
  return steerAlong(pick, car);
}

/**
 * Does this path go the way the task does? Where the task ends in one lane,
 * its way round is known from the road the car came in by: lane 3 of the
 * three-lane road goes round in the third ring lane or the fourth, a few
 * degrees apart where they start, and the task says which.
 */
function fitsTask(
  path: Path,
  entry: RailsState["entry"],
  task: { arm: ArmId; lane: number } | null | undefined,
): boolean {
  if (!task) return true;
  if (path.exit?.arm === task.arm && path.exit.lane !== task.lane) return false;
  if (!entry) return true;
  const way = turnBetween(entry.arm, task.arm);
  for (const edge of path.edges) {
    const m = /rb:[NSEW]\d:(left|straight|right|back)[:\d]/.exec(edge.id);
    if (!m) continue;
    if (m[1] !== way) return false;
    // the lane it comes out in, past the horizon if need be
    const out = exitOf(edge);
    return !out || out.arm !== task.arm || out.lane === task.lane;
  }
  return true;
}

/** Where a way round the ring (or the stretch onto it) comes out: road and lane. */
function exitOf(edge: NetEdge): { arm: ArmId; lane: number } | null {
  let here: NetEdge | undefined = edge;
  for (let hops = 0; here && hops < 3; hops += 1) {
    const m = /^([NSEW]):out:(\d)@/.exec(here.to);
    if (here.maneuver === "exit" && m) {
      return { arm: m[1] as ArmId, lane: Number(m[2]) };
    }
    here = successors(here)[0];
  }
  return null;
}

/** The knob smoothed over `SMOOTH_TIME`: a shake about one way averages out. */
function smooth(state: RailsState, knob: number, step: number): number {
  const x = Math.sin(knob);
  const z = -Math.cos(knob);
  if (state.steadyX == null || state.steadyZ == null) {
    state.steadyX = x;
    state.steadyZ = z;
  } else {
    const k = Math.min(1, step / SMOOTH_TIME);
    state.steadyX += (x - state.steadyX) * k;
    state.steadyZ += (z - state.steadyZ) * k;
  }
  return bearingOf(state.steadyX, state.steadyZ);
}

/**
 * How far off every path the knob may point before the thumb has the car.
 * On the ring: never pointing in (that is a thumb following the bend), and
 * outward only down an exit road close by, or a long way out.
 */
function freeLimit(car: CarState, knob: number): number {
  const loc = locate(car.x, car.z);
  if (loc.kind !== "ring") return FREE_AT;
  if (inwardOnRing(car, knob)) return Infinity;
  for (const id of ARM_ORDER) {
    if (!downExit(knob, laneBearing(id, "exit"), loc.bearing)) continue;
    const mouth = lanePoint(id, "exit", 1, RING_OUTER_R);
    const behind =
      wrapPi(bearingOf(mouth.x, mouth.z) - loc.bearing) < -EXIT_PAST;
    if (!behind && Math.hypot(car.x - mouth.x, car.z - mouth.z) <= EXIT_NEAR) {
      return FREE_AT;
    }
  }
  return RING_LAG;
}

/**
 * Does the knob point down this exit road, for a car on the ring at `bearing`
 * from the middle? Within the cone, and clearly outward of the way the ring
 * runs there.
 */
function downExit(knob: number, runs: number, bearing: number): boolean {
  // clockwise, so outward is the knob turned back from the ring's way
  const outward = -wrapPi(knob - bearing - Math.PI / 2);
  return Math.abs(wrapPi(knob - runs)) <= EXIT_CONE && outward >= EXIT_OUTWARD;
}

/** Pointing in across the island, on the ring: a thumb following the bend. */
function inwardOnRing(car: CarState, knob: number): boolean {
  const loc = locate(car.x, car.z);
  if (loc.kind !== "ring") return false;
  // clockwise, so the ring runs a quarter turn on from the car's bearing
  const turn = wrapPi(knob - (loc.bearing + Math.PI / 2));
  return turn > 0 && turn < INWARD;
}

/** Steer for a point on the path a little ahead, slowing for its bends. */
function steerAlong(path: Path, car: CarState): Steer {
  const pts = path.points;
  // how far off the path the car is: a long way off, it eases back over
  const near = pts.reduce(
    (best, p, i) => {
      const d = Math.hypot(p.x - car.x, p.z - car.z);
      return d < best.d ? { d, i } : best;
    },
    { d: Infinity, i: 0 },
  );
  let reach = Math.max(3.5 + 0.35 * Math.abs(car.speed), 2.2 * near.d);
  // on a tight bend, aiming far ahead cuts inside it: keep the aim close
  // (the bend coming up within that aim counts, or the car cuts in at its start)
  let bend = 0;
  for (let i = near.i; i + 2 < pts.length && i - near.i <= reach; i += 1) {
    bend = Math.max(bend, Math.abs(wrapPi(pts[i + 2].h - pts[i].h)) / 2);
  }
  if (bend > 1e-3) reach = Math.min(reach, Math.max(2, BEND_REACH / bend));
  const k = Math.min(pts.length - 1, near.i + Math.round(reach));
  const aim = pts[k];
  // the bends in the next stretch set the speed
  let cap: number = CAR.maxSpeed;
  const ahead = Math.max(8, 1.6 * Math.abs(car.speed));
  for (let i = near.i; i + 2 < pts.length && i - near.i < ahead; i += 1) {
    const turn = Math.abs(wrapPi(pts[i + 2].h - pts[i].h)) / 2;
    if (turn > 1e-4) cap = Math.min(cap, Math.sqrt(BEND_GRIP / turn));
  }
  if (path.edges.some((e, i) => i < 2 && e.road === "aisle")) {
    cap = Math.min(cap, AISLE_SPEED);
  }
  const key = path.edges.length ? laneKey(path.edges[0]) : null;
  return {
    heading: bearingOf(aim.x - car.x, aim.z - car.z),
    cap,
    aim: { x: aim.x, z: aim.z },
    along: aim.h,
    lane: key ? parseLane(key).lane : null,
    path: pts.slice(near.i, near.i + 16).map((p) => ({ x: p.x, z: p.z })),
  };
}
