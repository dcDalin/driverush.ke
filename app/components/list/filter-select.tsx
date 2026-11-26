/**
 * A select bound to an address param. The first option is the "all" choice
 * (value "all"), which removes the param. The chosen label is passed in, not
 * looked up: Radix only knows an option's text once its menu has opened, so
 * a fresh page would show an empty trigger.
 */
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { useListParams } from "~/lib/ui/use-list-params";
import { cn } from "~/lib/utils";

export type FilterOption = { value: string; label: string };

export function FilterSelect({
  param,
  pageKey = "page",
  label,
  options,
  className,
}: {
  param: string;
  pageKey?: string;
  /** The accessible name. */
  label: string;
  options: readonly FilterOption[];
  className?: string;
}) {
  const { searchParams, setParams } = useListParams(pageKey);
  const value = searchParams.get(param) ?? options[0]?.value ?? "all";
  const chosen =
    options.find((o) => o.value === value)?.label ?? options[0]?.label ?? "";
  return (
    <Select
      value={value}
      onValueChange={(next) => setParams({ [param]: String(next) })}
    >
      <SelectTrigger aria-label={label} className={cn("w-full", className)}>
        <SelectValue>{chosen}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
