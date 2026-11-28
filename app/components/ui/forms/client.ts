/**
 * Fields for forms handled in the browser (react-hook-form), such as the
 * sign-in sheet. Wrap the form in react-hook-form's `<FormProvider>`.
 */
import { useFormContext } from "react-hook-form";

import { createFormFields } from "./create-fields";

const fields = createFormFields(useFormContext, "Client");

export const InputField = fields.InputField;
export const TextareaField = fields.TextareaField;
export const SelectField = fields.SelectField;
export const CheckboxField = fields.CheckboxField;
export const CheckboxGroupField = fields.CheckboxGroupField;
export const SwitchField = fields.SwitchField;
export const OtpField = fields.OtpField;
