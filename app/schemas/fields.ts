/**
 * Field rules shared by every form (like thinkrush `packages/schemas`
 * userValidation): one place for what an email, a code or a slug must be,
 * and the sentence shown when it is not.
 */
import { z } from "zod";

export const EmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Type a full email address, like name@gmail.com."));

export const OtpCodeSchema = z
  .string()
  .transform((value) => value.replace(/\D/g, ""))
  .pipe(z.string().length(6, "The code has 6 digits."));

export const PasswordSchema = z.string().min(1, "Type your password.");

export const IdSchema = z.uuid("Something is missing. Reload and try again.");

export const BranchIdsSchema = z
  .array(IdSchema)
  .min(1, "Pick at least one branch.");

export const SlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(
    /^[a-z0-9]+(-[a-z0-9]+)*$/,
    "Lowercase letters, numbers and dashes, like top-gear.",
  )
  .min(2, "At least 2 characters.")
  .max(60, "At most 60 characters.");

export const NameSchema = z
  .string()
  .trim()
  .min(2, "At least 2 characters.")
  .max(120, "At most 120 characters.");

/** An optional short text: empty becomes "". */
export const OptionalTextSchema = z
  .string()
  .trim()
  .max(80, "At most 80 characters.")
  .default("");

/** A calendar day as a date input gives it: YYYY-MM-DD. */
export const DaySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date.");

/** An optional day: empty becomes "". */
export const OptionalDaySchema = z
  .union([z.literal(""), DaySchema])
  .default("");
