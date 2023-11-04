"use client";

import type { Table } from "@tanstack/react-table";
import { X } from "lucide-react";

import { Button } from "@openstatus/ui";
import { flyRegionsDict } from "@openstatus/utils";

import { codesDict } from "@/data/code-dictionary";
import { DataTableFacetedFilter } from "./data-table-faceted-filter";

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
          <DataTableFacetedFilter
            column={table.getColumn("statusCode")}
            title="Status Code"
            options={Object.keys(codesDict).map((key) => {
              const typedKey = key as keyof typeof codesDict;
              return {
                label: codesDict[typedKey].label,
                value: codesDict[typedKey].prefix,
              };
            })}
          />
        )}
        {table.getColumn("region") && (
          <DataTableFacetedFilter
            column={table.getColumn("region")}
            title="Region"
            options={Object.keys(flyRegionsDict).map((key) => {
              const typedKey = key as keyof typeof flyRegionsDict;
              return {
                label: flyRegionsDict[typedKey].location,
                value: flyRegionsDict[typedKey].code,
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
      {/* <DataTableDateRangePicker /> */}
    </div>
  );
}
