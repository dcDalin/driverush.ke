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

/**
 * A new school. Leave the owner's email empty to set the school up first
 * (hidden until it is handed over); with one, it is live at once.
 */
export const CreateSchoolSchema = z.object({
  intent: z.literal("create-school"),
  name: NameSchema,
  slug: SlugSchema,
  ownerEmail: z
    .string()
    .trim()
    .toLowerCase()
    .default("")
    .refine((v) => v === "" || z.email().safeParse(v).success, {
      message:
        "Type a full email address, or leave it empty to set it up first.",
    }),
});
export type CreateSchoolSchemaTypes = z.infer<typeof CreateSchoolSchema>;

/** Hands a school to its owner (and puts a school in setup live). */
export const HandOverSchema = z.object({
  intent: z.literal("hand-over"),
  schoolId: IdSchema,
  email: EmailSchema,
});
export type HandOverSchemaTypes = z.infer<typeof HandOverSchema>;

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

const MediaPath = z
  .string()
  .regex(/^[0-9a-f-]{36}\/livery\/[0-9a-f]{16}\.(webp|png|jpg)$/);
const Hex = z.string().regex(/^#[0-9a-f]{6}$/);
const HiLo = z.object({ hi: MediaPath, lo: MediaPath });

/**
 * A draft livery whose files the browser has just uploaded. The database
 * checks it again (each path in the school's own folder, staff only).
 */
export const LiveryDraftRowSchema = z.object({
  school_id: IdSchema,
  label: z.string().trim().min(1).max(80),
  base_color: Hex,
  rail: z.object({ gold: Hex, red: Hex }),
  paint: z.record(z.string(), HiLo).refine((p) => Object.keys(p).length > 0),
  top_board: z.object({
    path: MediaPath,
    width: z.number().positive(),
    height: z.number().positive(),
    metres: z.object({ width: z.number(), height: z.number() }),
    cut: z.number(),
    edge: Hex,
  }),
  banner: HiLo,
  posters: z.object({ logo: MediaPath, lessons: MediaPath }),
  marks: z.object({ full: MediaPath, mono: MediaPath }),
  thumbs: z.record(z.string(), MediaPath),
  stills: z.record(z.string(), MediaPath),
});
export type LiveryDraftRow = z.infer<typeof LiveryDraftRowSchema>;

/** The draft row, posted as JSON (remix-hook-form encoding) once its files are stored. */
export const SaveLiveryDraftSchema = z.object({
  intent: z.literal("save-livery-draft"),
  draft: LiveryDraftRowSchema,
});

/** The console's school list, from the address (?q=&status=&livery=&sponsoring=&page=). */
export const SchoolFiltersSchema = z.object({
  q: z.string().trim().max(80).catch(""),
  status: z
    .enum(["any", "setup", "active", "suspended", "archived"])
    .catch("any"),
  livery: z.enum(["any", "live", "draft", "none"]).catch("any"),
  sponsoring: z.enum(["any", "yes", "no"]).catch("any"),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
});

/** Inline actions posted by keyed fetchers. */
export const ConsoleActionSchema = z.discriminatedUnion("intent", [
  z.object({
    intent: z.literal("set-status"),
    schoolId: IdSchema,
    status: z.enum(["active", "suspended", "archived"]),
  }),
  z.object({ intent: z.literal("publish-livery"), liveryId: IdSchema }),
  z.object({ intent: z.literal("retire-livery"), liveryId: IdSchema }),
  z.object({ intent: z.literal("delete-livery"), liveryId: IdSchema }),
  z.object({ intent: z.literal("end-sponsorship"), sponsorshipId: IdSchema }),
  z.object({
    intent: z.literal("revoke-role"),
    email: EmailSchema,
    role: z.enum(["driverush_admin", "driverush_su"]),
  }),
]);
