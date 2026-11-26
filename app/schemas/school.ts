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
  z.object({ intent: z.literal("resend-student"), linkId: IdSchema }),
  z.object({
    intent: z.literal("move-student"),
    linkId: IdSchema,
    branchId: IdSchema,
  }),
]);

export const MemberActionSchema = z.discriminatedUnion("intent", [
  z.object({ intent: z.literal("remove-admin"), memberId: IdSchema }),
  z.object({ intent: z.literal("cancel-invite"), inviteId: IdSchema }),
  z.object({ intent: z.literal("resend-invite"), inviteId: IdSchema }),
]);

const optional = (max: number, message = `At most ${max} characters.`) =>
  z.string().trim().max(max, message).default("");

const PhoneSchema = z
  .string()
  .trim()
  .default("")
  .refine((v) => v === "" || /^\+?[0-9 ]{7,20}$/.test(v), {
    message: "Digits and spaces, like 0712 345 678.",
  });

const HttpsSchema = z
  .string()
  .trim()
  .default("")
  .refine((v) => v === "" || /^https:\/\/[^\s/?#]+\.[^\s]+$/.test(v), {
    message: "A full link starting https://",
  });

const ColourSchema = z
  .string()
  .trim()
  .toLowerCase()
  .default("")
  .refine((v) => v === "" || /^#[0-9a-f]{6}$/.test(v), {
    message: "A colour like #f4a20c.",
  });

const TimeSchema = z
  .string()
  .default("")
  .refine((v) => v === "" || /^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(v), {
    message: "A time like 08:00.",
  });

/** The school's profile: what learners read about it. Logos upload apart. */
export const UpdateProfileSchema = z.object({
  intent: z.literal("update-profile"),
  tagline: optional(80),
  about: optional(1200),
  phone: PhoneSchema,
  whatsapp: PhoneSchema,
  email: z
    .string()
    .trim()
    .toLowerCase()
    .default("")
    .refine((v) => v === "" || z.email().safeParse(v).success, {
      message: "Type a full email address, like name@gmail.com.",
    }),
  websiteUrl: HttpsSchema,
  facebook: HttpsSchema,
  instagram: HttpsSchema,
  tiktok: HttpsSchema,
  x: HttpsSchema,
  youtube: HttpsSchema,
  brandPaint: ColourSchema,
  brandInk: ColourSchema,
});
export type UpdateProfileSchemaTypes = z.infer<typeof UpdateProfileSchema>;

const opensBeforeCloses = (open: string, close: string) =>
  (open === "" && close === "") ||
  (open !== "" && close !== "" && open < close);

/**
 * A branch's details. Hours as learners need them: weekdays, Saturday and
 * Sunday, each open and close (both empty: closed).
 */
export const UpdateBranchDetailsSchema = z
  .object({
    intent: z.literal("update-branch-details"),
    branchId: IdSchema,
    address: optional(200),
    lat: z
      .string()
      .trim()
      .default("")
      .refine((v) => v === "" || (Number(v) >= -5 && Number(v) <= 5.5), {
        message: "A latitude in Kenya, like -1.2841.",
      }),
    lng: z
      .string()
      .trim()
      .default("")
      .refine((v) => v === "" || (Number(v) >= 33.5 && Number(v) <= 42.5), {
        message: "A longitude in Kenya, like 36.8233.",
      }),
    phone: PhoneSchema,
    weekdaysOpen: TimeSchema,
    weekdaysClose: TimeSchema,
    satOpen: TimeSchema,
    satClose: TimeSchema,
    sunOpen: TimeSchema,
    sunClose: TimeSchema,
  })
  .refine((v) => (v.lat === "") === (v.lng === ""), {
    path: ["lng"],
    message: "Give both, or neither.",
  })
  .refine((v) => opensBeforeCloses(v.weekdaysOpen, v.weekdaysClose), {
    path: ["weekdaysClose"],
    message: "Opening before closing, or both empty.",
  })
  .refine((v) => opensBeforeCloses(v.satOpen, v.satClose), {
    path: ["satClose"],
    message: "Opening before closing, or both empty.",
  })
  .refine((v) => opensBeforeCloses(v.sunOpen, v.sunClose), {
    path: ["sunClose"],
    message: "Opening before closing, or both empty.",
  });
export type UpdateBranchDetailsSchemaTypes = z.infer<
  typeof UpdateBranchDetailsSchema
>;

/** The hours a form gives, as `school_branches.hours` stores them. */
export function hoursFromForm(v: UpdateBranchDetailsSchemaTypes) {
  const day = (open: string, close: string) =>
    open && close ? { open, close } : null;
  const weekday = day(v.weekdaysOpen, v.weekdaysClose);
  return {
    mon: weekday,
    tue: weekday,
    wed: weekday,
    thu: weekday,
    fri: weekday,
    sat: day(v.satOpen, v.satClose),
    sun: day(v.sunOpen, v.sunClose),
  };
}

export const LOGO_KINDS = ["logo", "logo_mono"] as const;
export const LOGO_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
export const LOGO_MAX_BYTES = 5 * 1024 * 1024;

/** A logo file (the colour one, or the white one for brass plates). */
export const UploadLogoSchema = z.object({
  intent: z.literal("upload-logo"),
  kind: z.enum(LOGO_KINDS),
  file: z
    .instanceof(File, { message: "Choose a picture." })
    .refine((f) => f.size > 0, { message: "Choose a picture." })
    .refine((f) => f.size <= LOGO_MAX_BYTES, {
      message: "At most 5 MB.",
    })
    .refine((f) => (LOGO_TYPES as readonly string[]).includes(f.type), {
      message: "A PNG, JPEG or WebP picture.",
    }),
});

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
  "update-profile",
  "update-branch-details",
  "upload-logo",
] as const;
export type SchoolIntent = (typeof SCHOOL_INTENTS)[number];
