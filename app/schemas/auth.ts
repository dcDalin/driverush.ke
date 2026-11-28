/** The sign-in sheet's forms. */
import { z } from "zod";

import {
  EmailSchema,
  NewPasswordSchema,
  OtpCodeSchema,
  PasswordSchema,
} from "./fields";

export const PasswordSignInSchema = z.object({
  email: EmailSchema,
  password: PasswordSchema,
});
export type PasswordSignInSchemaTypes = z.infer<typeof PasswordSignInSchema>;

export const SignUpSchema = z.object({
  email: EmailSchema,
  password: NewPasswordSchema,
});
export type SignUpSchemaTypes = z.infer<typeof SignUpSchema>;

export const VerifyEmailCodeSchema = z.object({ code: OtpCodeSchema });
export type VerifyEmailCodeSchemaTypes = z.infer<typeof VerifyEmailCodeSchema>;

export const PasswordResetRequestSchema = z.object({ email: EmailSchema });
export type PasswordResetRequestSchemaTypes = z.infer<
  typeof PasswordResetRequestSchema
>;

export const PasswordResetSchema = z.object({
  code: OtpCodeSchema,
  password: NewPasswordSchema,
});
export type PasswordResetSchemaTypes = z.infer<typeof PasswordResetSchema>;
