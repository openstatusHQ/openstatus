"use client";

import type { RouterOutputs } from "@openstatus/api";
import { Monitor, Region, Warning, Close } from "@openstatus/icons";
import { Button } from "@openstatus/ui/components/ui/button";
import type { Table } from "@tanstack/react-table";

import { DataTableFacetedFilter } from "@/components/ui/data-table/data-table-faceted-filter";
import { regions } from "@/data/regions";
import { statusCodes } from "@/data/status-codes";

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
      <div className="flex-warp flex flex-1 flex-wrap items-center gap-2">
        {table.getColumn("status") && (
          <DataTableFacetedFilter
            column={table.getColumn("status")}
            title="Status"
            options={statusCodes.map((code) => ({
              label: code.code.toString(),
              value: code.code.toString(),
            }))}
            icon={Monitor}
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
            icon={Region}
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
            icon={Warning}
          />
        )}
        {isFiltered && (
          <Button
            variant="ghost"
            onClick={() => table.resetColumnFilters()}
            className="h-8 px-2 lg:px-3"
          >
            Reset
            <Close />
          </Button>
        )}
      </div>
      {/* <DataTableViewOptions table={table} /> */}
    </div>
  );
}
