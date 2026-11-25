/**
 * A form that posts to a route action without leaving the page
 * (remix-hook-form + a keyed fetcher, thinkrush's pattern for inline forms):
 *
 *   - validated in the browser with the zod schema, and again by the action
 *     (`validateForm`), whose field errors come back into the same fields;
 *   - its own fetcher (`key`), so two forms on one page never share errors;
 *   - the honeypot's hidden fields posted with the values (`withNativeFields`);
 *   - pending state for the submit button (`busy`).
 *
 * The action's flash message (remix-toast) shows as a toast once the root
 * revalidates after the submission.
 */
import { zodResolver } from "@hookform/resolvers/zod";
import * as React from "react";
import type { DefaultValues, FieldValues } from "react-hook-form";
import { useFetcher } from "react-router";
import { useRemixForm } from "remix-hook-form";
import type { z } from "zod";

import { withNativeFields } from "./with-native-fields";

export function useServerForm<S extends z.ZodType<FieldValues, FieldValues>>({
  schema,
  defaultValues,
  key,
  action,
  resetOnSuccess = false,
}: {
  schema: S;
  defaultValues: DefaultValues<z.input<S>>;
  /** Unique on the page: one fetcher (and one set of errors) per form. */
  key: string;
  /** The route to post to; this route when left out. */
  action?: string;
  /** Clear the fields once the action accepts them (add-forms). */
  resetOnSuccess?: boolean;
}) {
  const fetcher = useFetcher({ key });
  const formRef = React.useRef<HTMLFormElement>(null);
  const methods = useRemixForm<z.input<S>, unknown, z.output<S>>({
    mode: "onTouched",
    resolver: zodResolver(schema),
    defaultValues,
    fetcher,
    submitHandlers: {
      onValid: (values) => {
        if (!formRef.current) return;
        void fetcher.submit(
          withNativeFields(values as Record<string, unknown>, formRef.current),
          {
            method: "POST",
            action,
          },
        );
      },
    },
  });
  // Clear an add-form once its action accepted it (remix-hook-form's own
  // `resetOnSuccess` only follows navigations, not a fetcher we submit).
  const accepted =
    fetcher.state === "idle" &&
    (fetcher.data as { ok?: boolean } | undefined)?.ok === true;
  const { reset } = methods;
  React.useEffect(() => {
    if (resetOnSuccess && accepted) reset(defaultValues);
    // Once per accepted submission; defaultValues is the form's starting point.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accepted, fetcher.data, resetOnSuccess, reset]);

  return { methods, fetcher, formRef, busy: fetcher.state !== "idle" };
}
