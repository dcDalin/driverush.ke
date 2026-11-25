/**
 * Fields for forms that post to a route action (remix-hook-form). Wrap the
 * form in `<ServerFormProvider methods={useRemixForm(...)}>`.
 */
import type { ComponentProps, ReactNode } from "react";
import { RemixFormProvider, useRemixFormContext } from "remix-hook-form";

import { createFormFields } from "./create-fields";

const fields = createFormFields(useRemixFormContext, "Server");

export const InputField = fields.InputField;
export const TextareaField = fields.TextareaField;
export const SelectField = fields.SelectField;
export const CheckboxField = fields.CheckboxField;
export const CheckboxGroupField = fields.CheckboxGroupField;
export const SwitchField = fields.SwitchField;
export const OtpField = fields.OtpField;

type ProviderProps = Omit<ComponentProps<typeof RemixFormProvider>, "children">;

/**
 * remix-hook-form's provider. `useRemixForm`'s return type lags the
 * provider's props (thinkrush `TraFormProvider` has the same boundary), so the
 * methods pass through this one typed seam instead of a cast in every form.
 */
export function ServerFormProvider({
  methods,
  children,
}: {
  methods: unknown;
  children: ReactNode;
}) {
  return (
    <RemixFormProvider {...(methods as ProviderProps)}>
      {children}
    </RemixFormProvider>
  );
}
