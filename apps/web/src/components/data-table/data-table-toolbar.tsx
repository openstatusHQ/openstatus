"use client";

import type { Table } from "@tanstack/react-table";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { codesDict } from "@/data/code-dictionary";
import { regionsDict } from "@/data/regions-dictionary";
import { DataTableDateRangePicker } from "./data-table-date-ranger-picker";
import { DataTableFacetedFilter } from "./data-table-faceted-filter";
import { DataTableFilterDropDown } from "./data-table-filter-dropdown";
import { DataTableFilterInput } from "./data-table-filter-input";

interface DataTableToolbarProps<TData> {
  table: Table<TData>;
}

export function DataTableToolbar<TData>({
  table,
}: DataTableToolbarProps<TData>) {
  const isFiltered = table.getState().columnFilters.length > 0;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-1 items-center gap-2">
        {table.getColumn("statusCode") && (
      <DataTableFilterDropDown
        column={table.getColumn("statusCode")}
        title="Filter by Status Code"
        options={Object.keys(codesDict).map((key) => {
            const typedKey = key as keyof typeof codesDict;
            return {
              label: codesDict[typedKey].status_code,
              value: codesDict[typedKey].code,
            };
          })}
       />
     )}
      {table.getColumn("region") && (
        <DataTableFacetedFilter
          column={table.getColumn("region")}
          title="Region"
          options={Object.keys(regionsDict).map((key) => {
            const typedKey = key as keyof typeof regionsDict;
            return {
              label: regionsDict[typedKey].location,
              value: regionsDict[typedKey].code,
            };
          })}
        />
      )}
      {isFiltered && (
        <Button
          variant="ghost"
          onClick={() => table.resetColumnFilters()}
          className="h-8 px-2 lg:px-3"
        >
          Reset
          <X className="ml-2 h-4 w-4" />
        </Button>
      )}
    </div>
    <DataTableDateRangePicker />
  </div>
);}
