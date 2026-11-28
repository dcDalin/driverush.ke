/**
 * The parts under every field: its error (replacing the description while
 * there is one) and its helper text. CSS-only motion (`dr-rise`).
 */
import type { ReactNode } from "react";

import { Icon } from "~/components/brand/icon";
import { InfoIcon } from "~/components/brand/icons";
import { cn } from "~/lib/utils";

/** A validation message as plain text (no markup, no doubled spaces). */
export function plainText(text: string): string {
  return text
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function FieldError({
  id,
  children,
}: {
  id?: string;
  children: ReactNode;
}) {
  return (
    <p
      id={id}
      role="alert"
      className="dr-rise font-sans text-[13px] font-medium text-rush"
    >
      {children}
    </p>
  );
}

export function FieldDescription({
  id,
  children,
  className,
}: {
  id?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      id={id}
      className={cn(
        "flex items-start gap-1.5 font-sans text-[13px] text-ink-3",
        className,
      )}
    >
      <Icon icon={InfoIcon} size={14} className="mt-0.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

/** Below a field: the error if there is one, otherwise the description. */
export function FieldFooter({
  error,
  description,
  id,
}: {
  error: string | null;
  description?: ReactNode;
  id: string;
}) {
  if (error) return <FieldError id={id}>{error}</FieldError>;
  if (description)
    return <FieldDescription id={id}>{description}</FieldDescription>;
  return null;
}
