import { expect, it } from "vitest";

import { BOARD_CHALLENGES } from "./challenges";
import { TASK_NAMES } from "./task-names";

it("names every task, in order, as challenges.ts does", () => {
  expect(TASK_NAMES).toEqual(
    BOARD_CHALLENGES.map((c) => ({ id: c.id, title: c.title })),
  );
});
