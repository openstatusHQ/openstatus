"use client";

import type { Table } from "@tanstack/react-table";
import { X } from "lucide-react";

import type { MonitorTag } from "@openstatus/db/src/schema";
import { Button, Input } from "@openstatus/ui";

import { DataTableFacetedFilter } from "../data-table-faceted-filter";

interface DataTableToolbarProps<TData> {
  table: Table<TData>;
  tags?: MonitorTag[];
}

export function DataTableToolbar<TData>({
  table,
  tags,
}: DataTableToolbarProps<TData>) {
  const isFiltered = table.getState().columnFilters.length > 0;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-1 flex-wrap items-center gap-2">
        <Input
          placeholder="Filter names..."
          value={(table.getColumn("name")?.getFilterValue() as string) ?? ""}
          onChange={(event) =>
            table.getColumn("name")?.setFilterValue(event.target.value)
          }
          className="h-8 w-[150px] lg:w-[250px]"
        />
        {table.getColumn("tags") && tags && (
          <DataTableFacetedFilter
            column={table.getColumn("tags")}
            title="Tags"
            options={tags?.map((tag) => ({
              label: tag.name,
              value: tag.name,
            }))}
          />
        )}
        {table.getColumn("public") && (
          <DataTableFacetedFilter
            column={table.getColumn("public")}
            title="Visibility"
            options={[
              { label: "Public", value: true },
              { label: "Private", value: false },
            ]}
          />
        )}
        {table.getColumn("active") && (
          <DataTableFacetedFilter
            column={table.getColumn("active")}
            title="Active"
            options={[
              { label: "True", value: true },
              { label: "False", value: false },
            ]}
          />
        )}
        {table.getColumn("jobType") && (
          <DataTableFacetedFilter
            column={table.getColumn("jobType")}
            title="Type"
            options={[
              { label: "HTTP", value: "http" },
              { label: "TCP", value: "tcp" },
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
            <X className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>
      <div className="flex items-center self-end rounded-lg border border-dashed bg-muted/50 px-3 py-2">
        <p className="text-muted-foreground text-xs">
          Quantiles and Uptime are aggregated data from the{" "}
          <span className="text-foreground">last 24h</span>.
        </p>
      </div>
    </div>
  );
}
