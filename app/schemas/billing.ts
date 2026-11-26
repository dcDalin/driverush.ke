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

/**
 * The school's price: any whole number of shillings at or above the minimum
 * (DriveRush's share plus a little for the school), which the database holds
 * and checks; no ceiling (owner, 2026-11-26).
 */
export const SetPassPriceSchema = z.object({
  intent: z.literal("set-pass-price"),
  priceKes: z.coerce
    .number({ message: "Type a price in shillings." })
    .int("Whole shillings, like 700.")
    .min(1, "Type a price in shillings.")
    .max(1_000_000, "That is more than a pass can cost."),
});
export type SetPassPriceSchemaTypes = z.infer<typeof SetPassPriceSchema>;

/** A Kenyan bank account, as the school's bank letter gives it. */
const bankFields = {
  bankCode: z.string().trim().min(1, "Pick the bank."),
  accountNumber: z
    .string()
    .trim()
    .regex(/^[0-9]{6,20}$/, "Digits only, as on the bank letter."),
  accountName: z
    .string()
    .trim()
    .min(2, "The account's name, as the bank has it.")
    .max(100, "At most 100 characters."),
};

/** The owner sends their bank; DriveRush checks it before it is paid. */
export const RequestBankSchema = z.object({
  intent: z.literal("request-bank"),
  ...bankFields,
});
export type RequestBankSchemaTypes = z.infer<typeof RequestBankSchema>;

/** Staff set a bank they have checked with the school, live at once. */
export const SetUpPaymentsSchema = z.object({
  intent: z.literal("set-up-payments"),
  schoolId: IdSchema,
  code: SchoolCodeSchema,
  ...bankFields,
});
export type SetUpPaymentsSchemaTypes = z.infer<typeof SetUpPaymentsSchema>;

/** Staff change the code a school hands out. */
export const SetPassCodeSchema = z.object({
  intent: z.literal("set-pass-code"),
  schoolId: IdSchema,
  code: SchoolCodeSchema,
});
export type SetPassCodeSchemaTypes = z.infer<typeof SetPassCodeSchema>;

/** Staff approve the bank an owner sent, or turn it down with a reason. */
export const ReviewBankSchema = z
  .object({
    intent: z.literal("review-bank"),
    schoolId: IdSchema,
    decision: z.enum(["approve", "decline"]),
    note: z.string().trim().max(300, "At most 300 characters.").default(""),
  })
  .refine((v) => v.decision === "approve" || v.note.length >= 3, {
    message: "Say why, so the school can fix it.",
    path: ["note"],
  });
export type ReviewBankSchemaTypes = z.infer<typeof ReviewBankSchema>;

/** The console's payments list, from the address. */
export const PaymentFiltersSchema = z.object({
  q: z.string().trim().max(100).catch(""),
  status: z
    .enum(["any", "pending", "succeeded", "failed", "refunded"])
    .catch("any"),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
});
