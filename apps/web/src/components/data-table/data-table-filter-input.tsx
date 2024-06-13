"use client";

import type { Table } from "@tanstack/react-table";

import { Input } from "@openstatus/ui";

interface DataTableFilterInputProps<TData> {
  table: Table<TData>;
}

export function DataTableFilterInput<TData>({
  table,
}: DataTableFilterInputProps<TData>) {
  // const isFiltered = table.getState().columnFilters.length > 0;
  return (
    <Input
      type="number"
      placeholder="Filter status code..."
      value={(table.getColumn("statusCode")?.getFilterValue() as string) ?? ""}
      onChange={(event) => {
        table.getColumn("statusCode")?.setFilterValue(event.target.value);
      }}
      className="h-8 w-[150px] lg:w-[250px]"
    />
  );
}
