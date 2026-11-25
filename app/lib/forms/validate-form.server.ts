/**
 * The action side of `useServerForm`: the honeypot first, then the same zod
 * schema the browser used. `errors` go back to the fields as they are.
 */
import { zodResolver } from "@hookform/resolvers/zod";
import type { FieldValues } from "react-hook-form";
import { getValidatedFormData } from "remix-hook-form";
import type { z } from "zod";

import { checkHoneypot } from "./honeypot.server";

export async function validateForm<
  S extends z.ZodType<FieldValues, FieldValues>,
>(formData: FormData, schema: S) {
  await checkHoneypot(formData);
  return getValidatedFormData<z.input<S>, unknown, z.output<S>>(
    formData,
    zodResolver(schema),
  );
}
