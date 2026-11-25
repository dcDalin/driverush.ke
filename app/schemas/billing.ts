/**
 * The pass forms: a learner paying (alone, through their school, or for 30
 * more days), a school owner setting their price, and staff turning on a
 * school's payments. The database checks every rule again.
 */
import { z } from "zod";

import { IdSchema } from "./fields";

/** HELTZ-style: what a school hands its learners. */
export const SchoolCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9]{3,12}$/, "3 to 12 letters or numbers, like HELTZ.");

/** A level to come back to after paying (`?level=` on /pass). */
const ReturnLevelSchema = z
  .string()
  .regex(/^[a-z0-9-]{1,60}$/)
  .optional()
  .or(z.literal("").transform(() => undefined));

export const BuyPassSchema = z.discriminatedUnion("plan", [
  z.object({
    intent: z.literal("buy"),
    plan: z.literal("learner_pass"),
    level: ReturnLevelSchema,
  }),
  z.object({
    intent: z.literal("buy"),
    plan: z.literal("learner_extension"),
    level: ReturnLevelSchema,
  }),
  z.object({
    intent: z.literal("buy"),
    plan: z.literal("school_pass"),
    /** Empty: the learner's current school. */
    schoolCode: z.union([z.literal(""), SchoolCodeSchema]).default(""),
    /** Empty: the branch the school added them to, or its only branch. */
    branchId: z.union([z.literal(""), IdSchema]).default(""),
    level: ReturnLevelSchema,
  }),
]);
export type BuyPassSchemaTypes = z.infer<typeof BuyPassSchema>;

export const SetPassPriceSchema = z.object({
  intent: z.literal("set-pass-price"),
  priceKes: z.coerce
    .number({ message: "Type a price in shillings." })
    .int("Whole shillings, like 700.")
    .min(500, "At least KES 500.")
    .max(1000, "At most KES 1,000."),
});
export type SetPassPriceSchemaTypes = z.infer<typeof SetPassPriceSchema>;

export const SetUpPaymentsSchema = z.object({
  intent: z.literal("set-up-payments"),
  schoolId: IdSchema,
  code: SchoolCodeSchema,
  bankCode: z.string().trim().min(1, "Pick the school's bank."),
  accountNumber: z
    .string()
    .trim()
    .regex(/^[0-9]{6,20}$/, "Digits only, as on the school's bank letter."),
  businessName: z
    .string()
    .trim()
    .min(2, "The account's name, as the bank has it.")
    .max(100, "At most 100 characters."),
});
export type SetUpPaymentsSchemaTypes = z.infer<typeof SetUpPaymentsSchema>;
