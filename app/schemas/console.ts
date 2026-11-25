/** The DriveRush console's forms and inline actions. */
import { z } from "zod";

import {
  DaySchema,
  EmailSchema,
  IdSchema,
  NameSchema,
  OptionalDaySchema,
  SlugSchema,
} from "./fields";

export const CreateSchoolSchema = z.object({
  intent: z.literal("create-school"),
  name: NameSchema,
  slug: SlugSchema,
  ownerEmail: EmailSchema,
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

/** A sponsorship: its cars take turns for guests and free learners. */
export const SetSponsorshipSchema = z
  .object({
    intent: z.literal("set-sponsorship"),
    schoolId: IdSchema,
    startsOn: DaySchema,
    endsOn: OptionalDaySchema,
    note: z.string().trim().max(200, "At most 200 characters.").default(""),
  })
  .refine((v) => !v.endsOn || v.endsOn >= v.startsOn, {
    path: ["endsOn"],
    message: "The end is before the start.",
  });
export type SetSponsorshipSchemaTypes = z.infer<typeof SetSponsorshipSchema>;

/** Inline actions posted by keyed fetchers. */
export const ConsoleActionSchema = z.discriminatedUnion("intent", [
  z.object({
    intent: z.literal("set-status"),
    schoolId: IdSchema,
    status: z.enum(["active", "suspended", "archived"]),
  }),
  z.object({ intent: z.literal("publish-livery"), liveryId: IdSchema }),
  z.object({ intent: z.literal("retire-livery"), liveryId: IdSchema }),
  z.object({ intent: z.literal("end-sponsorship"), sponsorshipId: IdSchema }),
  z.object({
    intent: z.literal("revoke-role"),
    email: EmailSchema,
    role: z.enum(["driverush_admin", "driverush_su"]),
  }),
]);
