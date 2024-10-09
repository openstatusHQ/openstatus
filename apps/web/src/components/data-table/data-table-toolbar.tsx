"use client";

import type { Table } from "@tanstack/react-table";
import { Clock, Network, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@openstatus/ui/src/components/button";
import { flyRegionsDict } from "@openstatus/utils";

import { codesDict } from "@/data/code-dictionary";
import { DataTableFacetedFilter } from "./data-table-faceted-filter";
import { DataTableFacetedInputDropdown } from "./data-table-faceted-input-dropdown";

interface DataTableToolbarProps<TData> {
  table: Table<TData>;
}

export function DataTableToolbar<TData>({
  table,
}: DataTableToolbarProps<TData>) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isFiltered = table.getState().columnFilters.length > 0;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-1 flex-wrap items-center gap-2">
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
        {table.getColumn("error") && (
          <DataTableFacetedFilter
            column={table.getColumn("error")}
            title="Request"
            options={[
              // once we include 'degraded' requests, we can revert error to a number
              { value: true, label: "Failed" },
              { value: false, label: "Success" },
            ]}
          />
        )}
        {table.getColumn("latency") && (
          <DataTableFacetedInputDropdown
            title="Latency"
            column={table.getColumn("latency")}
            options={[
              { value: "min", label: "Min." },
              { value: "max", label: "Max." },
            ]}
          />
        )}
        {table.getColumn("trigger") && (
          <DataTableFacetedFilter
            column={table.getColumn("trigger")}
            title="Trigger"
            options={[
              { value: "cron", label: "Cronjob", icon: Clock },
              { value: "api", label: "API", icon: Network },
            ]}
          />
        )}
        {isFiltered && (
          <Button
            variant="ghost"
            onClick={() => {
              const period = searchParams.get("period");
              table.resetColumnFilters();
              if (period) {
                router.replace(`?period=${period}`, {
                  scroll: false,
                });
              }
            }}
            className="h-8 px-2 lg:px-3"
          >
            Reset
            <X className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
