/** The DriveRush console's forms and inline actions. */
import { z } from "zod";

import { EmailSchema, IdSchema, NameSchema, SlugSchema } from "./fields";

export const NO_LIVERY = "none";

export const CreateSchoolSchema = z.object({
  intent: z.literal("create-school"),
  name: NameSchema,
  slug: SlugSchema,
  ownerEmail: EmailSchema,
  sponsorId: z.string().default(NO_LIVERY),
});
export type CreateSchoolSchemaTypes = z.infer<typeof CreateSchoolSchema>;

export const TransferOwnerSchema = z.object({
  intent: z.literal("transfer-owner"),
  schoolId: IdSchema,
  email: EmailSchema,
});
export type TransferOwnerSchemaTypes = z.infer<typeof TransferOwnerSchema>;

export const GrantRoleSchema = z.object({
  intent: z.literal("grant-role"),
  email: EmailSchema,
  role: z.enum(["driverush_admin", "driverush_su"]),
});
export type GrantRoleSchemaTypes = z.infer<typeof GrantRoleSchema>;

/** Inline actions posted by keyed fetchers. */
export const ConsoleActionSchema = z.discriminatedUnion("intent", [
  z.object({
    intent: z.literal("set-status"),
    schoolId: IdSchema,
    status: z.enum(["active", "suspended", "archived"]),
  }),
  z.object({
    intent: z.literal("revoke-role"),
    email: EmailSchema,
    role: z.enum(["driverush_admin", "driverush_su"]),
  }),
]);
