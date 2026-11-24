/**
 * Every driving task's id and title, in `BOARD_CHALLENGES` order, and nothing
 * else: for pages that name a task (today's drive on home and the Board page)
 * without loading the board's geometry, cars and parking layouts.
 * `task-names.test.ts` fails if this list and `challenges.ts` disagree.
 */
export type TaskName = { id: string; title: string };

export const TASK_NAMES: readonly TaskName[] = [
  { id: "straight", title: "Go straight" },
  { id: "left", title: "Turn left" },
  { id: "right", title: "Turn right" },
  { id: "back", title: "U-turn" },
  { id: "turn-back", title: "Turn back" },
  { id: "behind-red", title: "Behind the red car" },
  { id: "three-lane-right", title: "Right from the three-lane road" },
  { id: "three-lane-back", title: "U-turn on the three-lane road" },
  { id: "to-two-way", title: "Right, then the two-way road" },
  { id: "down-the-street", title: "Down the street" },
  { id: "from-two-way", title: "Back to the dual carriageway" },
  { id: "long-way-round", title: "The longest correct route" },
  { id: "park-flush", title: "Flush parking" },
  { id: "leave-flush", title: "Pull out of flush parking" },
  { id: "park-angle", title: "Angle parking" },
  { id: "leave-angle", title: "Reverse out of the bay" },
  { id: "blocked-lane", title: "A lane is blocked" },
  { id: "blocked-ring", title: "A lane on the roundabout is blocked" },
  { id: "blocked-exit", title: "An exit is blocked" },
  { id: "blocked-gap", title: "The gap is blocked" },
  { id: "blocked-street", title: "The street is blocked" },
  { id: "blocked-parking", title: "The way into the parking is blocked" },
];
