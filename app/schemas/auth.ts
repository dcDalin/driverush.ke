/** The sign-in sheet's forms. */
import { z } from "zod";

import { EmailSchema, OtpCodeSchema, PasswordSchema } from "./fields";

export const EmailCodeRequestSchema = z.object({ email: EmailSchema });
export type EmailCodeRequestSchemaTypes = z.infer<
  typeof EmailCodeRequestSchema
>;

export const VerifyEmailCodeSchema = z.object({ code: OtpCodeSchema });
export type VerifyEmailCodeSchemaTypes = z.infer<typeof VerifyEmailCodeSchema>;

export const PasswordSignInSchema = z.object({
  email: EmailSchema,
  password: PasswordSchema,
});
export type PasswordSignInSchemaTypes = z.infer<typeof PasswordSignInSchema>;
