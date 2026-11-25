/**
 * What the learner reads when they make a mistake: the rule, in plain words,
 * and what to do instead. The board's answer to `miss-tips.ts`. The rules are
 * the NTSA Kenya Learner Driver Handbook, Unit 3, and the lane options the way
 * Perez's Model Town Board tutorial teaches them (`LANE_OPTIONS`).
 */
import { type LaneRule, lanesForTurn, rulesFor, type Turn } from "./geometry";
import type { Fault, FaultId } from "./referee";

export const RULES_SOURCE = "Kenya Learner Driver Handbook, NTSA";
/**
 * Where the blocked-road rule comes from. It is how instructors set the board
 * up, not a line of the handbook, so it is never credited to the handbook.
 */
export const BLOCK_SOURCE = "How driving instructors set the board";
/** Where the lane options' ring lanes and exit lanes come from. */
export const OPTIONS_SOURCE = "Perez's Model Town Board tutorial";

export type FaultTip = {
  id: FaultId;
  title: string;
  reason: string;
  /** The rule in one line, for the toast and the result card. */
  rule: string;
  /** Where the rule comes from, when it is not the handbook. */
  source?: string;
};

const TURN_VERB: Record<Turn, string> = {
  left: "turn left",
  straight: "go straight",
  right: "turn right",
  back: "come back",
};

const TURN_PAST: Record<Turn, string> = {
  left: "turned left",
  straight: "went straight",
  right: "turned right",
  back: "came back",
};

function laneList(lanes: number[]): string {
  if (lanes.length <= 1) return `lane ${lanes[0]}`;
  return `lane ${lanes.slice(0, -1).join(", ")} or ${lanes[lanes.length - 1]}`;
}

/**
 * The lanes to approach in for a turn, the usual ones first. The innermost
 * lane can make every turn, but for left and straight on it is the long way
 * round, so it is not the lane to send a learner to.
 */
function approachAdvice(lanes: number, turn: Turn): string {
  const all = lanesForTurn(lanes, turn);
  const longWay = turn === "left" || (turn === "straight" && lanes === 4);
  const usual =
    longWay && all.length > 1 ? all.filter((n) => n !== lanes) : all;
  const extra =
    usual.length < all.length
      ? ` Lane ${lanes} can also do it, once round the island first.`
      : "";
  return `approach in ${laneList(usual)}.${extra}`;
}

/** One lane's options, in the words of the owner's rule sheet. */
export function laneRule(lanes: number, lane: number): string {
  if (lane <= 1) {
    return "Lane 1 has two options: go straight (0°) or turn left (90°). Maintain lane 1 to exit.";
  }
  if (lane === 2) {
    return "Lane 2 has one option: go straight (0°). Maintain lane 2 to exit.";
  }
  if (lanes === 4 && lane === 3) {
    return "Lane 3 has two options: go straight (0°) or turn right (90°). Maintain lane 3 to exit; turning right onto the minor road you exit into lane 2 (minus 1).";
  }
  if (lanes === 4) {
    return "Lane 4 has four options: turn right (90°), U-turn (180°), Q-turn (270°) and go straight (360°) after a full loop. Maintain lane 4 to exit.";
  }
  return "Lane 3 has five options: go straight (0°) or turn right (90°) into lane 3, maintaining lane 3; or shift to lane 4 to turn right (90°) into lane 4, U-turn (180°) or Q-turn (270°).";
}

/** One option in a sentence, with the degrees schools count for it. */
function optionWords(rule: LaneRule, outs: number): string {
  const into = outs > 1 ? ` into lane ${rule.exit}` : "";
  const name =
    rule.turn === "back"
      ? "make the U-turn"
      : rule.turn === "left" && rule.fullCircle
        ? "make the Q-turn"
        : rule.turn === "straight" && rule.fullCircle
          ? "go straight after a full loop"
          : `${TURN_VERB[rule.turn]}${into}`;
  return `${name} (${rule.degrees}°)`;
}

/** The option a lane makes for one turn in one roundabout lane, in words. */
function optionFor(
  lanes: number,
  lane: number,
  turn: Turn,
  ring: number | undefined,
): string {
  const rule = rulesFor(lanes, lane, turn, ring)[0];
  return rule
    ? optionWords(rule, rulesFor(lanes, lane, turn).length)
    : TURN_VERB[turn];
}

/** Which lane to leave in, the rule the exit-lane fault points to. */
const EXIT_RULE =
  "Maintain your lane to exit. From lane 3 or 4 of the major road onto the minor road, exit lane = entry lane minus 1.";

type RuleWords = { title: string; rule: string; source?: string };

const RULES: Record<FaultId, RuleWords> = {
  kerb: {
    title: "You hit the kerb",
    rule: "Stay off the kerb. No driving or stopping on it.",
  },
  central_reserve: {
    title: "You hit the central reserve",
    rule: "The central reserve keeps the two directions apart.",
  },
  island: {
    title: "You hit the island",
    rule: "Go round the island, clockwise, in your lane.",
  },
  solid_line: {
    title: "Over a continuous white line",
    rule: "A continuous white line means no changing lanes, and no driving on it. Change where the lines are broken.",
  },
  roundabout_lane_change: {
    title: "Lane change on the roundabout",
    rule: "No changing lanes on the roundabout. Go round in your option's lane until your exit.",
  },
  roundabout_stop: {
    title: "Keep moving",
    rule: "No stopping or waiting on the roundabout.",
  },
  wrong_exit: {
    title: "Wrong lane for that turn",
    rule: "Pick the lane for your turn before the roundabout.",
  },
  wrong_destination: {
    title: "Not the turn you were asked for",
    rule: "Take the turn the examiner asked for.",
  },
  wrong_way: {
    title: "Wrong way",
    rule: "Keep left, and go round the roundabout clockwise.",
  },
  centre_line: {
    title: "Over the centre line",
    rule: "A continuous yellow centre line means stay on your side. Cross only where it is broken.",
  },
  full_circle: {
    title: "All the way round",
    rule: "Only lane 4, the innermost lane, may make a full circle.",
  },
  missed_exit: {
    title: "Past your last exit",
    rule: "Leave at your option's exit. Only the innermost lane goes once round first, and never twice.",
    source: OPTIONS_SOURCE,
  },
  wrong_option: {
    title: "Not this car's option",
    rule: "Drive the option the car was given: its turn, its roundabout lane and its exit lane.",
    source: OPTIONS_SOURCE,
  },
  collision: {
    title: "You hit the red car",
    rule: "Stop behind the car in front and leave a gap.",
  },
  past_end: {
    title: "Past the green box",
    rule: "Slow down early and stop inside the green box.",
  },
  off_route: {
    title: "Not the way you were asked",
    rule: "Follow the road the examiner asked for.",
  },
  wrong_lane: {
    title: "Wrong lane for the turn",
    rule: "Be in the lane for your turn before you reach it, and hold it.",
  },
  stop_line: {
    title: "You did not stop at the stop line",
    rule: "At a stop line you stop every time, even when the road is clear.",
  },
  exit_lane: {
    title: "Wrong lane leaving the roundabout",
    rule: EXIT_RULE,
    source: OPTIONS_SOURCE,
  },
  u_turn_lane: {
    title: "Wrong lane to turn back",
    rule: "Turn back from the lane beside the central reserve, into the lane beside it.",
  },
  crossing_stop: {
    title: "Stopped on the crossing",
    rule: "No stopping, parking or waiting on a pedestrian crossing.",
  },
  kerb_stop: {
    title: "Stopped beside a yellow kerb",
    rule: "Yellow kerb: no stopping, no waiting, no parking.",
  },
  board_edge: {
    title: "The edge of the board",
    rule: "The road runs off the board here, so the car is picked up and put back on the road.",
  },
  bay_line: {
    title: "Not straight in the bay",
    rule: "Park with the whole car inside the lines, straight in the bay.",
  },
  longer_way: {
    title: "A longer correct way",
    rule: "Rule 1: take the shortest correct route without parking.",
  },
};

function reasonFor(fault: Fault): string {
  switch (fault.id) {
    case "kerb":
      return "You drove into the kerb at the edge of the road. No driving, stopping or parking on it.";
    case "central_reserve":
      return "You drove into the central reserve. It separates you from the traffic coming the other way, so keep to your own lanes.";
    case "island":
      return "You drove into the island in the middle of the roundabout. Turn with the road and go round it clockwise, staying in your lane.";
    case "solid_line":
      return "You crossed a continuous white line between two lanes, or drove along on top of it. Near the roundabout the lane lines are continuous, on the way in and on the way out. That means stay in your lane there. Change lanes further from the roundabout, where the lines are broken.";
    case "roundabout_lane_change":
      return `You moved out of your lane inside the roundabout. Choose your lane before you enter, go round in it, and leave it only at your exit. Lane ${fault.lane ?? 1} on the road goes round in lane ${fault.lane ?? 1} of the roundabout, counting from the outside. The one exception is lane 3 of the three-lane road: to turn right into lane 4, come back or turn left, it goes round in the fourth lane, beside the island, and joins it on the way in.`;
    case "roundabout_stop":
      return "You stood still on the roundabout. A brief pause is fine, but there is no stopping or waiting on it. Keep moving until you've taken your exit.";
    case "wrong_exit": {
      const lanes = fault.lanes ?? 4;
      const turn = fault.turn ?? "straight";
      if (fault.circle) {
        const short = turn === "left" ? "turn left" : "go straight on";
        const lanesFor = turn === "left" ? "lane 1" : "lane 1, 2 or 3";
        return `The ${turn === "left" ? "Q-turn (270°)" : "go straight (360°)"} from the innermost lane is made after a full loop. Pass the exit the first time, go on round beside the island, and leave at it the second time. To ${short} the short way, approach in ${lanesFor}.`;
      }
      if (lanes === 3 && fault.lane === 3 && fault.ring === 3) {
        return `${laneRule(lanes, 3)} You went round in the third lane, so you could only go straight or turn right into lane 3.`;
      }
      if (lanes === 3 && fault.lane === 3 && fault.ring === 4) {
        return `${laneRule(lanes, 3)} You went round in the fourth lane, so going straight on was not one of your options.`;
      }
      return `${laneRule(lanes, fault.lane ?? 1)} To ${TURN_VERB[turn]}, ${approachAdvice(lanes, turn)}`;
    }
    case "wrong_destination": {
      const asked = fault.asked ?? "straight";
      const did = fault.turn ?? "straight";
      return `You were asked to ${TURN_VERB[asked]}, but you ${TURN_PAST[did]}. Your lane may take that exit, so no rule was broken and nobody stops you, but only the turn you were asked for is a pass. To ${TURN_VERB[asked]} from this road, ${approachAdvice(fault.lanes ?? 4, asked)} Count the exits as you go round: left is the first, straight the second, right the third.`;
    }
    case "wrong_way":
      return "You drove against the traffic. In Kenya you keep left, and you go round a roundabout clockwise.";
    case "centre_line":
      return "You crossed the continuous yellow centre line into the lane coming the other way. A continuous yellow line means stay on your side: no overtaking and no turning across it. You may cross only where the yellow line is broken.";
    case "full_circle":
      return `You went all the way round after entering in lane ${fault.lane ?? 1}. Only the innermost lane, lane 4, may make a full circle (360°). Lanes 3, 2 and 1 take their exit the first time they reach it.`;
    case "missed_exit": {
      const lanes = fault.lanes ?? 4;
      const lane = fault.lane ?? 1;
      const inner = (fault.ring ?? lane) === 4;
      return `You went on round past the last exit your lane may take. ${laneRule(lanes, lane)} ${
        inner
          ? "The innermost lane goes once round the island only for the Q-turn (270°) and the 360°, and leaves the next time it reaches that exit. It never goes round twice."
          : "Lanes 1 to 3 take their exit the first time they reach it, and never go all the way round."
      } Count the exits as you go: left is the first, straight the second, right the third.`;
    }
    case "wrong_option": {
      const lanes = fault.lanes ?? 4;
      const lane = fault.lane ?? 1;
      const asked = optionFor(
        lanes,
        lane,
        fault.asked ?? "straight",
        fault.askedRing,
      );
      const did = optionFor(lanes, lane, fault.turn ?? "straight", fault.ring);
      return `This car was given lane ${lane}'s option to ${asked}, but you drove the option to ${did}. Both are options of lane ${lane}, but in this lesson each car shows one, so only its own counts. ${laneRule(lanes, lane)}`;
    }
    case "collision":
      return fault.block
        ? "You drove into the upside-down car. An instructor turns a car over to close that way, so you may not touch it or squeeze past it. Look for it before you set off, then take the next correct route: the shortest one that is still open, without using the parking area unless nothing else is left."
        : "You drove into the red car. Ease off early and stop behind it with a gap.";
    case "off_route":
      return "You left the way you were asked to go, for a road or a part of the road this task does not use. No rule was broken, so nobody stops you, but only the route you were asked for is a pass. Stay on the road you were asked to take, and stop in the green box.";
    case "wrong_lane":
      return "You made the turn from a lane that does not make it. At a junction, turn left from the lane by the kerb. Be in that lane before you reach the turn, and hold it.";
    case "stop_line":
      return "You drove over the stop line without stopping. A stop line means stop every time, look both ways, and go only when the road is clear.";
    case "exit_lane":
      return `You left the roundabout in the wrong lane, one of the common mistakes.${fault.exitLanes?.length ? ` That way out from lane ${fault.lane ?? 1} leaves in ${laneList(fault.exitLanes)}.` : ""} Maintain your lane to exit. From lane 3 or 4 of the major road onto the minor road, use the minus 1 rule: lane 3 exits into lane 2, lane 4 into lane 3. Lane 3 of the minor road, shifted to lane 4, comes back into lane 3. Change lanes only further on, where the lines are broken.`;
    case "u_turn_lane":
      return `To turn back through a gap in the central reserve, be in lane ${fault.lane ?? 4}, the lane beside the reserve, before you reach the gap. Finish the turn in the lane beside the reserve on the other side, then change lanes where the lines are broken.`;
    case "crossing_stop":
      return "You stood still on the white bars of the pedestrian crossing. A brief pause is fine, but stop before it when someone is crossing, and never on it. The same goes for the roundabout and the yellow kerb: no stopping, parking or waiting there.";
    case "kerb_stop":
      return "You stood still beside a yellow kerb. A brief pause is fine, but a yellow kerb means no stopping, no waiting, no parking and no overtaking. Keep moving, and stop only at a stop or give way line, or in a parking bay.";
    case "bay_line":
      return "The car is in the bay but over a line or at an angle. Straighten up so the whole car sits inside the lines. You can reverse a little to line it up.";
    case "longer_way":
      return "You got there by a correct way and broke no rule, so it is a pass. But Rule 1 picks a shorter way, and an examiner wants the shortest correct route that avoids the parking area. Watch the right way to see it.";
    case "board_edge":
      return "You reached the frame of the board, where the road runs off it. On a real board the instructor picks the car up and puts it back on the road: here a car driven to the end is turned round onto the other side, facing back the way it came. No rule was broken.";
    case "past_end":
      return "You drove on past the green box. No rule was broken, so nobody stops you, but the drive is only a pass if you stop in the box when you reach it. Ease off as you reach the box, then let go and the car brakes to a stop.";
  }
}

/** Hitting an upside-down car is a collision with its own words. */
const BLOCK_HIT = {
  title: "You hit the upside-down car",
  rule: "An upside-down car means that way is blocked. Find the next correct route.",
};

export function faultTip(fault: Fault): FaultTip {
  const words =
    fault.id === "collision" && fault.block ? BLOCK_HIT : RULES[fault.id];
  return {
    id: fault.id,
    ...words,
    reason: reasonFor(fault),
    ...(words === BLOCK_HIT ? { source: BLOCK_SOURCE } : {}),
  };
}

export function faultRule(id: FaultId): string {
  return RULES[id].rule;
}

/** The handbook's lane tables, for the guide and the briefing. */
export const FOUR_LANE_TABLE: readonly { lane: number; does: string }[] = [
  { lane: 1, does: "Two options: go straight (0°) or turn left (90°)." },
  { lane: 2, does: "One option: go straight (0°)." },
  {
    lane: 3,
    does: "Two options: go straight (0°) or turn right (90°). Maintain lane 3 to exit; turning right you exit into lane 2 of the minor road (minus 1).",
  },
  {
    lane: 4,
    does: "Four options: turn right (90°), U-turn (180°), Q-turn (270°), and go straight (360°) after a full loop. Maintain lane 4 to exit; onto the minor road you exit into lane 3 (minus 1).",
  },
];

export const THREE_LANE_TABLE: readonly { lane: number; does: string }[] = [
  { lane: 1, does: "Two options: go straight (0°) or turn left (90°)." },
  { lane: 2, does: "One option: go straight (0°)." },
  {
    lane: 3,
    does: "Five options. Maintain lane 3 to go straight (0°) or turn right (90°) into lane 3. Shift to lane 4 to turn right (90°) into lane 4, U-turn (180°) back onto the minor road, or Q-turn (270°) onto the road on the left.",
  },
];
