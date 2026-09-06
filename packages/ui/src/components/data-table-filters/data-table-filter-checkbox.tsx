"use client";

import { useDataTable } from "@openstatus/ui/components/data-table-filters/data-table-provider";
import { Checkbox } from "@openstatus/ui/components/ui/checkbox";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@openstatus/ui/components/ui/input-group";
import { Label } from "@openstatus/ui/components/ui/label";
import { Skeleton } from "@openstatus/ui/components/ui/skeleton";
import { formatCompactNumber } from "@openstatus/ui/lib/format";
import { cn } from "@openstatus/ui/lib/utils";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";

import type { DataTableCheckboxFilterField, Option } from "./types";

export function DataTableFilterCheckbox<TData>({
  value: _value,
  options,
  component,
  keepEmptyOptions,
}: DataTableCheckboxFilterField<TData>) {
  const value = _value as string;
  const [inputValue, setInputValue] = useState("");
  const {
    table,
    columnFilters,
    isLoading,
    isFacetsLoading,
    getFacetedUniqueValues,
  } = useDataTable();
  const column = table.getColumn(value);
  // REMINDER: avoid using column?.getFilterValue()
  const filterValue = columnFilters.find((i) => i.id === value)?.value;
  const facetedValue =
    getFacetedUniqueValues?.(table, value) || column?.getFacetedUniqueValues();

  const Component = component;

  // CHECK: it could be filterValue or searchValue
  const filters = useMemo(
    () =>
      filterValue
        ? Array.isArray(filterValue)
          ? filterValue
          : [filterValue]
        : [],
    [filterValue],
  );

  // `options` is a baseline, not the whole set: a column holds values nobody
  // declared (an unusual status code) and declares values the data never
  // contains. The facets know which values exist, so they win when present;
  // `options` then only supplies labels. Selected values are kept regardless,
  // so a filter can always be unchecked. `keepEmptyOptions` opts a column out
  // of the pruning half: every declared option stays, at a count of zero.
  const resolvedOptions = useMemo(() => {
    if (!facetedValue?.size) {
      // A value picked out of an earlier facet list is not in `options`, and a
      // window with no rows would drop it here — leaving a filter that is
      // applied but has no box to uncheck.
      // Through a Set like the faceted branch below: the filter value is
      // whatever the URL held, so `?region=ams,ams` would otherwise render two
      // rows keyed on the same value.
      const declaredValues = new Set(options?.map((option) => option.value));
      const orphans = Array.from(new Set(filters as Option["value"][]))
        .filter((value) => !declaredValues.has(value))
        .map((value) => ({ label: String(value), value }) as Option);
      return orphans.length > 0 ? [...(options ?? []), ...orphans] : options;
    }
    const present = new Set<Option["value"]>([
      ...facetedValue.keys(),
      ...filters,
    ]);
    // Declared options keep their declared order — regions are grouped, not
    // alphabetical, and facets arrive count-descending.
    const declared = keepEmptyOptions
      ? options
      : options?.filter((option) => present.has(option.value));
    const declaredValues = new Set(declared?.map((option) => option.value));
    const resolved = [
      ...(declared ?? []),
      ...Array.from(present)
        .filter((value) => !declaredValues.has(value))
        .map((value) => ({ label: String(value), value })),
    ];
    return resolved.every((option) => typeof option.value === "number")
      ? resolved.sort((a, b) => (a.value as number) - (b.value as number))
      : resolved;
  }, [facetedValue, options, filters, keepEmptyOptions]);

  // filter out the options based on the input value
  const filterOptions = resolvedOptions?.filter(
    (option) =>
      inputValue === "" ||
      option.label.toLowerCase().includes(inputValue.toLowerCase()),
  );

  // REMINDER: if no options are defined, while fetching data, we should show a skeleton
  if (isLoading && !filterOptions?.length)
    return (
      <div className="border-border grid divide-y rounded-lg border">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="flex items-center justify-between gap-2 px-2 py-2.5"
          >
            <Skeleton className="h-4 w-4 rounded-sm" />
            <Skeleton className="h-4 w-full rounded-sm" />
          </div>
        ))}
      </div>
    );

  return (
    <div className="grid gap-2">
      {resolvedOptions && resolvedOptions.length > 4 ? (
        <InputGroup className="h-9 rounded-lg shadow-none">
          <InputGroupAddon>
            <Search className="mt-0.5 h-4 w-4" />
          </InputGroupAddon>
          <InputGroupInput
            placeholder="Search"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
          />
        </InputGroup>
      ) : null}
      {/* FIXME: due to the added max-h and overflow-y-auto, the hover state and border is laying on top of the scroll bar */}
      <div className="border-border max-h-[200px] overflow-y-auto rounded-lg border empty:border-none">
        {filterOptions
          // TODO: we shoudn't sort the options here, instead filterOptions should be sorted by default
          // .sort((a, b) => a.label.localeCompare(b.label))
          ?.map((option, index) => {
            const checked = filters.includes(option.value);

            return (
              <div
                key={String(option.value)}
                className={cn(
                  "group hover:bg-accent/50 relative flex items-center space-x-2 px-2 py-2.5",
                  index !== filterOptions.length - 1 ? "border-b" : undefined,
                )}
              >
                <Checkbox
                  id={`${value}-${option.value}`}
                  checked={checked}
                  onCheckedChange={(checked) => {
                    const newValue = checked
                      ? [...(filters || []), option.value]
                      : filters?.filter((value) => option.value !== value);
                    column?.setFilterValue(
                      newValue?.length ? newValue : undefined,
                    );
                  }}
                  className="border-foreground! shadow-none"
                />
                <Label
                  htmlFor={`${value}-${option.value}`}
                  className={cn(
                    "group-hover:text-accent-foreground flex w-full items-center justify-center gap-1 truncate",
                    checked ? "text-foreground" : "text-foreground/70",
                  )}
                >
                  {Component ? (
                    <Component {...option} />
                  ) : (
                    <span className="truncate font-normal">{option.label}</span>
                  )}
                  <span className="ml-auto flex min-w-8 items-center justify-end font-mono text-xs group-hover:invisible">
                    {isLoading || isFacetsLoading ? (
                      <Skeleton className="h-4 w-8" />
                    ) : facetedValue?.has(option.value) ? (
                      formatCompactNumber(facetedValue.get(option.value) || 0)
                    ) : keepEmptyOptions && facetedValue?.size ? (
                      formatCompactNumber(0)
                    ) : null}
                  </span>
                  <button
                    type="button"
                    onClick={() => column?.setFilterValue([option.value])}
                    className={cn(
                      "text-muted-foreground hover:text-foreground absolute inset-y-0 right-0 hidden items-center px-2 font-normal group-hover:flex",
                      "focus-visible:border-ring focus-visible:ring-ring/50 rounded-md transition-colors outline-none focus-visible:ring-[3px]",
                    )}
                  >
                    only
                  </button>
                </Label>
              </div>
            );
          })}
      </div>
    </div>
  );
}
