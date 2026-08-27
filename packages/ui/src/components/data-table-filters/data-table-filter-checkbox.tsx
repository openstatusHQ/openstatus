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
import { useState } from "react";

import type { DataTableCheckboxFilterField } from "./types";

export function DataTableFilterCheckbox<TData>({
  value: _value,
  options,
  component,
}: DataTableCheckboxFilterField<TData>) {
  const value = _value as string;
  const [inputValue, setInputValue] = useState("");
  const { table, columnFilters, isLoading, getFacetedUniqueValues } =
    useDataTable();
  const column = table.getColumn(value);
  // REMINDER: avoid using column?.getFilterValue()
  const filterValue = columnFilters.find((i) => i.id === value)?.value;
  const facetedValue =
    getFacetedUniqueValues?.(table, value) || column?.getFacetedUniqueValues();

  const Component = component;

  // filter out the options based on the input value
  const filterOptions = options?.filter(
    (option) =>
      inputValue === "" ||
      option.label.toLowerCase().includes(inputValue.toLowerCase()),
  );

  // CHECK: it could be filterValue or searchValue
  const filters = filterValue
    ? Array.isArray(filterValue)
      ? filterValue
      : [filterValue]
    : [];

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
      {options && options.length > 4 ? (
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
                  <span className="ml-auto flex items-center justify-center font-mono text-xs">
                    {isLoading ? (
                      <Skeleton className="h-4 w-4" />
                    ) : facetedValue?.has(option.value) ? (
                      formatCompactNumber(facetedValue.get(option.value) || 0)
                    ) : null}
                  </span>
                  <button
                    type="button"
                    onClick={() => column?.setFilterValue([option.value])}
                    className={cn(
                      "text-muted-foreground hover:text-foreground absolute inset-y-0 right-0 hidden font-normal backdrop-blur-xs group-hover:block",
                      "focus-visible:border-ring focus-visible:ring-ring/50 rounded-md transition-all outline-none focus-visible:ring-[3px]",
                    )}
                  >
                    <span className="px-2">only</span>
                  </button>
                </Label>
              </div>
            );
          })}
      </div>
    </div>
  );
}
