"use client";

import type { Table } from "@tanstack/react-table";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { RouterOutputs } from "@openstatus/api";
import { DataTableFacetedFilter } from "@/components/ui/data-table/data-table-faceted-filter";

type Monitor = RouterOutputs["monitor"]["list"][number];
type MonitorTag = RouterOutputs["monitorTag"]["list"][number];

export interface MonitorDataTableToolbarProps {
  table: Table<Monitor>;
  tags: MonitorTag[];
}

export function MonitorDataTableToolbar({
  table,
  tags,
}: MonitorDataTableToolbarProps) {
  const isFiltered = table.getState().columnFilters.length > 0;

  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-1 flex-wrap items-center space-x-2">
        <Input
          placeholder="Filter name..."
          value={(table.getColumn("name")?.getFilterValue() as string) ?? ""}
          onChange={(event) =>
            table.getColumn("name")?.setFilterValue(event.target.value)
          }
          className="h-8 w-[150px] lg:w-[250px]"
        />
        {table.getColumn("tags") && (
          <DataTableFacetedFilter
            column={table.getColumn("tags")}
            title="Tags"
            options={tags.map((tag) => ({
              label: tag.name,
              value: tag.id,
            }))}
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
    </div>
  );
}
