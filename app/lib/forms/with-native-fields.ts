import { createFormData } from "remix-hook-form";

/**
 * `useRemixForm` submits only its own values, so the honeypot's hidden inputs
 * would never reach the action. This builds the FormData as remix-hook-form
 * does, then adds every native field it does not already hold (thinkrush
 * `form-data.ts`). Use it in `submitHandlers.onValid`.
 */
export function withNativeFields(
  values: Record<string, unknown>,
  form: HTMLFormElement,
): FormData {
  const formData = createFormData(values);
  for (const [key, value] of new FormData(form)) {
    if (key in values || formData.has(key)) continue;
    formData.append(key, value);
  }
  return formData;
}
