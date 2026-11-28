import { useFormAction, useNavigation } from "react-router";

/**
 * True while this route's own form submission is in flight (thinkrush
 * `use-is-pending.ts`). Pair with a submit button's `isLoading`.
 */
export function useIsPending({
  formAction,
  formMethod = "POST",
}: {
  formAction?: string;
  formMethod?: "POST" | "GET" | "PUT" | "PATCH" | "DELETE";
} = {}) {
  const contextual = useFormAction();
  const navigation = useNavigation();
  return (
    navigation.state !== "idle" &&
    navigation.formAction === (formAction ?? contextual) &&
    navigation.formMethod === formMethod
  );
}
