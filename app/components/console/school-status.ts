/** How a school's status is named and coloured in the console. */
import type { SchoolStatus } from "~/database/types";

export const STATUS_LABEL: Record<SchoolStatus, string> = {
  setup: "Setting up",
  active: "Active",
  suspended: "Suspended",
  archived: "Archived",
};

export const STATUS_BADGE = {
  setup: "cyan",
  active: "green",
  suspended: "amber",
  archived: "outline",
} as const;
