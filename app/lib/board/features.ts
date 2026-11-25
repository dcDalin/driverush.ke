/**
 * The things painted on the board that a learner has to be able to name: what
 * each one is and what it asks of the driver. Learn mode points the camera at
 * each in turn. The rules are the NTSA handbook's (Unit 3, "Model Town").
 */
import {
  BOARD_LANDMARKS,
  type Box,
  RING_R,
  ROADS,
  SOLID_TO,
  U_TURN_GAPS,
} from "./full-board";

export type BoardFeature = {
  id: string;
  name: string;
  note: string;
  /** The part of the board to look at. */
  box: Box;
  /** The road sign that goes with it, where there is one. */
  sign?: { to: string; label: string };
  /**
   * Where a pin stands on it, when the middle of its box will not do: the
   * roundabout's middle is the island.
   */
  pin?: { x: number; z: number };
};

/** Where a pin for this feature stands on the table. */
export function featurePin(f: BoardFeature): { x: number; z: number } {
  return (
    f.pin ?? { x: (f.box.x0 + f.box.x1) / 2, z: (f.box.z0 + f.box.z1) / 2 }
  );
}

const { SIDE, STREET, AISLE, PARK, FLUSH, CROSSINGS, WIDE, NARROW } = ROADS;

const around = (x: number, z: number, half: number): Box => ({
  x0: x - half,
  x1: x + half,
  z0: z - half,
  z1: z + half,
});

export const BOARD_FEATURES: readonly BoardFeature[] = [
  {
    id: "roundabout",
    name: "Roundabout",
    note: "A meeting point where more than two roads meet, so vehicles can go different ways without obstruction or collision. Keep left and go round it clockwise. Lanes are counted from the outermost lane to the innermost. Give way to traffic already on it, coming from your right. No stopping, waiting, parking, overtaking or changing lanes on it. Choose your lane before you reach it. The pale yellow cross marks the middle of each road: leave before you reach the line of the road you want. You drive over the cross; it is not a line you must keep off.",
    box: around(0, 0, RING_R + 6),
    // on the lanes going round, not on the island in the middle
    pin: { x: RING_R - 4.5, z: 0 },
    sign: { to: "/road-signs/roundabout-ahead", label: "Roundabout ahead" },
  },
  {
    id: "island",
    name: "Traffic island",
    note: "The green part at the centre of the roundabout, which controls how vehicles move round it. You go round it and never over it. Only the innermost lane, lane 4, may make a full circle (360°) from the four-lane road, or a 270° turn from the three-lane road.",
    box: around(0, 0, 13),
  },
  {
    id: "lane-numbers",
    name: "Lane numbers",
    note: "Lanes are counted from the outermost lane to the innermost. Lane 1 is by the kerb and the highest number is in the middle of the road. The roundabout's lanes are counted the same way, from the outside in.",
    box: { x0: -WIDE - 3, x1: 3, z0: RING_R - 2, z1: SOLID_TO + 6 },
  },
  {
    id: "lane-arrows",
    name: "Lane arrows",
    note: "The arrow painted in a lane shows where that lane may go. The four-lane road is 2124: lane 1 has two options (straight or left), lane 2 one (straight), lane 3 two (straight or right) and lane 4 four (turn right, U-turn, Q-turn, and go straight after a full loop). The three-lane road is 215.",
    box: { x0: -WIDE - 3, x1: 3, z0: RING_R - 2, z1: SOLID_TO + 2 },
  },
  {
    id: "continuous-lines",
    name: "Continuous white lines",
    note: "A white continuous line means no changing lanes or overtaking. Near the roundabout the lines between lanes are continuous, so you should already be in the lane for your turn.",
    box: { x0: -WIDE - 3, x1: 3, z0: RING_R - 2, z1: SOLID_TO + 4 },
  },
  {
    id: "broken-lines",
    name: "Broken white lines",
    note: "A white dotted or broken line means you may overtake or change lanes if the road is clear and safe. Further back from the roundabout the lines are broken, and this is where you may change lanes, so this is where you choose the lane for your turn. Check your mirrors and signal for 3 seconds before you move across.",
    box: { x0: -WIDE - 3, x1: 3, z0: SOLID_TO - 2, z1: SOLID_TO + 28 },
  },
  {
    id: "dual-carriageway",
    name: "Dual carriageway",
    note: "A one-way traffic road on each side of the central reserve: all vehicles on it move in one direction, with white continuous or broken lines dividing it into equal lanes. Four lanes each way. It runs the length of the board and through the roundabout.",
    box: { x0: -WIDE - 6, x1: WIDE + 6, z0: -112, z1: -30 },
  },
  {
    id: "central-reserve",
    name: "Central reserve",
    note: "The raised green strip down the middle of the dual carriageway. It separates the one-way traffic roads, so you are kept apart from traffic coming the other way. You never drive over it.",
    box: { x0: -WIDE, x1: WIDE, z0: -62, z1: -26 },
  },
  {
    id: "u-turn-gap",
    name: "Gap in the central reserve",
    note: "A break in the central reserve: an exit from the main road, or a U-turn onto the other side. Be in the lane beside the reserve first, and give way to traffic on the side you are joining.",
    box: {
      x0: -WIDE,
      x1: WIDE,
      z0: -U_TURN_GAPS[0].to - 9,
      z1: -U_TURN_GAPS[0].from + 9,
    },
  },
  {
    id: "three-lane-road",
    name: "Three-lane road",
    note: "Three lanes each way, with a double yellow line down the middle dividing it into two equal parts. A double yellow line means stay on your side: no crossing it to turn or overtake. Its option code at the roundabout is 215.",
    box: { x0: -58, x1: -RING_R + 2, z0: -NARROW - 8, z1: NARROW + 8 },
  },
  {
    id: "yellow-kerb",
    name: "Yellow kerb",
    note: "A yellow marking that protects the land, or field: the green part on the left side of the road. A yellow kerb means no overtaking, no parking, no waiting and no stopping. A brief pause is fine, but standing still beside it costs a star. Stay off every kerb.",
    box: { x0: 6, x1: 38, z0: 2, z1: 34 },
  },
  {
    id: "two-way-road",
    name: "Two-way road",
    note: "A road where vehicles move in opposite directions: one lane each way, with a single yellow line at the centre dividing it into two equal parts. A continuous yellow line means stick to your side, no overtaking. A broken yellow line means you may overtake if the road is clear. Keep left unless you are overtaking.",
    box: { x0: SIDE.x0 - 10, x1: SIDE.x1 + 2, z0: 12, z1: 62 },
    sign: {
      to: "/road-signs/two-way-traffic-ahead",
      label: "Two-way traffic ahead",
    },
  },
  {
    id: "crossing",
    name: "Pedestrian crossing",
    note: "A safe, marked area across the two-way road where pedestrians have right of way. Slow down, and stop when pedestrians are crossing so they can get from one side to the other. No stopping, parking or waiting on it.",
    box: around(BOARD_LANDMARKS.crossing.x, CROSSINGS[1], 14),
    sign: {
      to: "/road-signs/pedestrian-crossing",
      label: "Pedestrian crossing",
    },
  },
  {
    id: "street",
    name: "The street",
    note: "A short two-way road joining the dual carriageway to the two-way road. It has a give way line at one end and a stop line at the other.",
    box: {
      x0: WIDE - 6,
      x1: SIDE.x0 + 6,
      z0: STREET.z0 - 8,
      z1: STREET.z1 + 8,
    },
  },
  {
    id: "stop-line",
    name: "Stop line",
    note: "A thick continuous white line across your side of the road, with a Stop sign: a red eight-sided sign (an octagon) with white letters. It is where you join a two-way traffic road. Stop every time, look right, left and right again, and go only when the road is clear.",
    box: around(SIDE.x0 - 2, STREET.mid, 12),
    sign: { to: "/road-signs/stop", label: "Stop" },
  },
  {
    id: "give-way-line",
    name: "Give way line",
    note: "A broken white line across your side of the road, with a Give way sign: a red triangle with its point facing down and a white border. Slow down, or stop if necessary, and go only when it is safe.",
    box: around(WIDE + 2, STREET.mid, 12),
    sign: { to: "/road-signs/give-way", label: "Give way" },
  },
  {
    id: "angle-parking",
    name: "Angle parking",
    note: "The angle, ample or controlled parking zone: bays painted at 45 degrees on both sides of a two-way aisle. It is strictly for small cars (saloons). Park from the farthest end, by forward gear, and leave by reverse, with the whole car inside the lines. Only drive through here when no other correct route gets you there.",
    box: {
      x0: PARK.x0 - 6,
      x1: PARK.x1 + 6,
      z0: PARK.z0 - 4,
      z1: PARK.z1 + 4,
    },
  },
  {
    id: "parking-aisle",
    name: "Parking aisle",
    note: "The road through the parking zone. It is two-way, with a give way line at each end. Drive slowly: a car may pull out of a bay on either side.",
    box: {
      x0: AISLE.x0 - 8,
      x1: AISLE.x1 + 8,
      z0: -NARROW - 22,
      z1: -NARROW + 6,
    },
  },
  {
    id: "flush-parking",
    name: "Flush parking",
    note: "The flush, parallel or uncontrolled parking zone: boxes on the left side of the two-way road in the direction of traffic. It has no security, so it is uncontrolled. All vehicles may use it except tractors and trailers. It has an entry, but leave space for the exit. Park from the farthest end by reverse, and leave by driving forward.",
    box: {
      x0: SIDE.x0 - 8,
      x1: SIDE.x1 + 2,
      z0: FLUSH.z0 - 6,
      z1: FLUSH.z1 + 6,
    },
  },
];
