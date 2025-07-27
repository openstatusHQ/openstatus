"use client";

import type { Table } from "@tanstack/react-table";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";

import { DataTableFacetedFilter } from "@/components/ui/data-table/data-table-faceted-filter";
import { regions } from "@/data/regions";
import { statusCodes } from "@/data/status-codes";
import type { RouterOutputs } from "@openstatus/api";

type ResponseLog = RouterOutputs["tinybird"]["list"]["data"][number];

export interface ResponseLogsDataTableToolbarProps {
  table: Table<ResponseLog>;
}

export function ResponseLogsDataTableToolbar({
  table,
}: ResponseLogsDataTableToolbarProps) {
  const isFiltered = table.getState().columnFilters.length > 0;

  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-1 flex-warp flex-wrap items-center gap-2">
        {table.getColumn("status") && (
          <DataTableFacetedFilter
            column={table.getColumn("status")}
            title="Status"
            options={statusCodes.map((code) => ({
              label: code.code.toString(),
              value: code.code.toString(),
            }))}
          />
        )}
        {table.getColumn("region") && (
          <DataTableFacetedFilter
            column={table.getColumn("region")}
            title="Region"
            options={regions.map((region) => ({
              label: region.location,
              value: region.code,
            }))}
          />
        )}
        {table.getColumn("error") && (
          <DataTableFacetedFilter
            column={table.getColumn("error")}
            title="Error"
            options={[
              { label: "Yes", value: "true" },
              { label: "No", value: "false" },
            ]}
          />
        )}
        {isFiltered && (
          <Button
            variant="ghost"
            onClick={() => table.resetColumnFilters()}
            className="h-8 px-2 lg:px-3"
          >
            Reset
            <X />
          </Button>
        )}
      </div>
      {/* <DataTableViewOptions table={table} /> */}
    </div>
  );
}
