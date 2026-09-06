"use client";

import { useDataTable } from "@openstatus/ui/components/data-table-filters/data-table-provider";
import { Button } from "@openstatus/ui/components/ui/button";
import { X } from "lucide-react";

import type { DataTableFilterField } from "./types";

export function DataTableFilterResetButton<TData>({
  value: _value,
}: DataTableFilterField<TData>) {
  const { columnFilters, table } = useDataTable();
  const value = _value as string;
  const column = table.getColumn(value);
  const filterValue = columnFilters.find((f) => f.id === value)?.value;

  // TODO: check if we could useMemo
  const filters = filterValue
    ? Array.isArray(filterValue)
      ? filterValue
      : [filterValue]
    : [];

  if (filters.length === 0) return null;

  return (
    <Button
      variant="outline"
      className="h-5 gap-1 rounded-full px-1.5! py-1! font-mono text-[10px] shadow-none"
      onClick={(e) => {
        e.stopPropagation();
        column?.setFilterValue(undefined);
      }}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.code === "Enter") {
          column?.setFilterValue(undefined);
        }
      }}
      asChild
    >
      {/* REMINDER: `AccordionTrigger` is also a button(!) and we get Hydration error when rendering button within button */}
      <div role="button" tabIndex={0}>
        <span>{filters.length}</span>
        <X className="text-muted-foreground ml-1! size-2.5!" />
      </div>
    </Button>
  );
}
