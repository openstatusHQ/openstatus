"use client";

import { DataTableFacetedFilter } from "@/components/ui/data-table/data-table-faceted-filter";
import type { RouterOutputs } from "@openstatus/api";
import { Button } from "@openstatus/ui/components/ui/button";
import type { Table } from "@tanstack/react-table";
import { CircleCheck, Globe, X } from "lucide-react";

type Subscriber = RouterOutputs["pageSubscriber"]["list"][number];

const STATUS_OPTIONS = [
  { label: "Active", value: "active" },
  { label: "Pending", value: "pending" },
  { label: "Unsubscribed", value: "unsubscribed" },
];

const SOURCE_OPTIONS = [
  { label: "Self-signup", value: "self_signup" },
  { label: "Vendor", value: "vendor" },
  { label: "Import", value: "import" },
];

function filterAvailable<T extends { value: string }>(
  options: T[],
  facets: Map<string, number> | undefined,
) {
  if (!facets) return [];
  return options.filter((option) => facets.has(option.value));
}

export function SubscribersDataTableToolbar({
  table,
}: {
  table: Table<Subscriber>;
}) {
  const isFiltered = table.getState().columnFilters.length > 0;

  const statusFacets = table.getColumn("status")?.getFacetedUniqueValues();
  const sourceFacets = table.getColumn("source")?.getFacetedUniqueValues();

  const statusOptions = filterAvailable(STATUS_OPTIONS, statusFacets);
  const sourceOptions = filterAvailable(SOURCE_OPTIONS, sourceFacets);

  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-1 flex-wrap items-center gap-2">
        {table.getColumn("status") && statusOptions.length > 0 && (
          <DataTableFacetedFilter
            column={table.getColumn("status")}
            title="Status"
            options={statusOptions}
            icon={CircleCheck}
          />
        )}
        {table.getColumn("source") && sourceOptions.length > 0 && (
          <DataTableFacetedFilter
            column={table.getColumn("source")}
            title="Source"
            options={sourceOptions}
            icon={Globe}
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
