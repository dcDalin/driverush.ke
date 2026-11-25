/**
 * A school dashboard's forms and inline actions. Each inline action carries
 * its `intent`, so one route action can tell them apart.
 */
import { z } from "zod";

import {
  BranchIdsSchema,
  EmailSchema,
  IdSchema,
  NameSchema,
  OptionalTextSchema,
} from "./fields";

export const AddStudentSchema = z.object({
  intent: z.literal("add-student"),
  email: EmailSchema,
  branchId: IdSchema,
});
export type AddStudentSchemaTypes = z.infer<typeof AddStudentSchema>;

export const AddAdminSchema = z.object({
  intent: z.literal("add-admin"),
  email: EmailSchema,
  branchIds: BranchIdsSchema,
});
export type AddAdminSchemaTypes = z.infer<typeof AddAdminSchema>;

export const AddBranchSchema = z.object({
  intent: z.literal("add-branch"),
  name: NameSchema,
  town: OptionalTextSchema,
});
export type AddBranchSchemaTypes = z.infer<typeof AddBranchSchema>;

export const UpdateBranchSchema = z.object({
  intent: z.literal("update-branch"),
  branchId: IdSchema,
  name: NameSchema,
  town: OptionalTextSchema,
  isActive: z.boolean(),
});
export type UpdateBranchSchemaTypes = z.infer<typeof UpdateBranchSchema>;

export const SetAdminBranchesSchema = z.object({
  intent: z.literal("set-admin-branches"),
  memberId: IdSchema,
  branchIds: BranchIdsSchema,
});
export type SetAdminBranchesSchemaTypes = z.infer<
  typeof SetAdminBranchesSchema
>;

/** Inline actions posted by keyed fetchers (no form fields to show). */
export const StudentActionSchema = z.discriminatedUnion("intent", [
  z.object({ intent: z.literal("release-student"), linkId: IdSchema }),
  z.object({ intent: z.literal("cancel-student"), linkId: IdSchema }),
  z.object({
    intent: z.literal("move-student"),
    linkId: IdSchema,
    branchId: IdSchema,
  }),
]);

export const MemberActionSchema = z.discriminatedUnion("intent", [
  z.object({ intent: z.literal("remove-admin"), memberId: IdSchema }),
  z.object({ intent: z.literal("cancel-invite"), inviteId: IdSchema }),
]);

export const SCHOOL_INTENTS = [
  "add-student",
  "add-admin",
  "add-branch",
  "update-branch",
  "set-admin-branches",
  "release-student",
  "cancel-student",
  "move-student",
  "remove-admin",
  "cancel-invite",
] as const;
export type SchoolIntent = (typeof SCHOOL_INTENTS)[number];
