/**
 * A search box bound to an address param. Typing updates the address after a
 * short pause (so the list reloads once, not per keystroke); the cross clears
 * it; Clear filters or the back button flow back into the box.
 */
import { useEffect, useId, useState } from "react";

import { Icon } from "~/components/brand/icon";
import { CloseIcon, SearchIcon } from "~/components/brand/icons";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { useListParams } from "~/lib/ui/use-list-params";
import { cn } from "~/lib/utils";

export function SearchInput({
  param = "q",
  pageKey = "page",
  placeholder,
  label,
  delay = 300,
  className,
}: {
  param?: string;
  pageKey?: string;
  placeholder: string;
  /** Accessible name; the placeholder by default. */
  label?: string;
  delay?: number;
  className?: string;
}) {
  const id = useId();
  const { searchParams, setParams } = useListParams(pageKey);
  const urlValue = searchParams.get(param) ?? "";
  const [text, setText] = useState(urlValue);
  const [prevUrlValue, setPrevUrlValue] = useState(urlValue);

  // Follow the address when it changes from elsewhere.
  if (prevUrlValue !== urlValue) {
    setPrevUrlValue(urlValue);
    setText(urlValue);
  }

  useEffect(() => {
    if (text.trim() === urlValue) return;
    const timeout = setTimeout(
      () => setParams({ [param]: text.trim() }),
      delay,
    );
    return () => clearTimeout(timeout);
  }, [text, urlValue, param, delay, setParams]);

  return (
    <div className={cn("relative w-full", className)}>
      <Label htmlFor={id} className="sr-only">
        {label ?? placeholder}
      </Label>
      <Icon
        icon={SearchIcon}
        size={18}
        className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-3"
      />
      <Input
        id={id}
        type="search"
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        className="px-10 [&::-webkit-search-cancel-button]:hidden"
      />
      {text ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setText("")}
          aria-label="Clear search"
          className="absolute top-1/2 right-1 h-8 w-8 -translate-y-1/2 px-0"
        >
          <Icon icon={CloseIcon} size={14} />
        </Button>
      ) : null}
    </div>
  );
}
