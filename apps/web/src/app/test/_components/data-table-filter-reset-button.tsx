"use client";

import useUpdateSearchParams from "@/hooks/use-update-search-params";
import { Button } from "@openstatus/ui";
import type { Table } from "@tanstack/react-table";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import type { DataTableFilterField } from "./types";

interface DataTableFilterResetButtonProps<TData>
  extends DataTableFilterField<TData> {
  table: Table<TData>;
}

export function DataTableFilterResetButton<TData>({
  table,
  value: _value,
}: DataTableFilterResetButtonProps<TData>) {
  const value = _value as string;
  const updateSearchParams = useUpdateSearchParams();
  const router = useRouter();
  const column = table.getColumn(value);
  const filterValue = column?.getFilterValue();

  // TODO: check if we could useMemo
  const filters = filterValue
    ? Array.isArray(filterValue)
      ? filterValue
      : [filterValue]
    : [];

  const updatePageSearchParams = (values: Record<string, string | null>) => {
    const newSearchParams = updateSearchParams(values);
    router.replace(`?${newSearchParams}`, { scroll: false });
  };

  if (filters.length === 0) return null;

  return (
    <Button
      variant="outline"
      className="h-5 rounded-full px-1.5 py-1 font-mono text-[10px]"
      onClick={(e) => {
        e.stopPropagation();
        column?.setFilterValue(undefined);
        updatePageSearchParams({ [value]: null });
      }}
      asChild
    >
      {/* REMINDER: `AccordionTrigger` is also a button(!) and we get Hydration error when rendering button within button */}
      <div role="button">
        <span>{filters.length}</span>
        <X className="ml-1 h-2.5 w-2.5 text-muted-foreground" />
      </div>
    </Button>
  );
}
