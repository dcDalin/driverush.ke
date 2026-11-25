/**
 * The `intent` an action dispatches on. remix-hook-form posts every value
 * JSON-quoted (`"add-student"`); a fetcher or a plain form posts it raw.
 * This reads both.
 */
export function readFormIntent(formData: FormData): string {
  const raw = formData.get("intent");
  if (typeof raw !== "string") return "";
  try {
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === "string" ? parsed : raw;
  } catch {
    return raw;
  }
}

/** A fetcher's or plain form's fields as an object for a zod schema. */
export function formFields(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of formData)
    if (typeof value === "string") out[key] = value;
  return out;
}
