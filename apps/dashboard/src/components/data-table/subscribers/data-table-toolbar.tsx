"use client";

import { DataTableFacetedFilter } from "@/components/ui/data-table/data-table-faceted-filter";
import type { RouterOutputs } from "@openstatus/api";
import { Button } from "@openstatus/ui/components/ui/button";
import type { Table } from "@tanstack/react-table";
import { X } from "lucide-react";

type Subscriber = RouterOutputs["pageSubscriber"]["list"][number];

export function SubscribersDataTableToolbar({
  table,
}: {
  table: Table<Subscriber>;
}) {
  const isFiltered = table.getState().columnFilters.length > 0;

  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-1 flex-wrap items-center gap-2">
        {table.getColumn("status") && (
          <DataTableFacetedFilter
            column={table.getColumn("status")}
            title="Status"
            options={[
              { label: "Active", value: "active" },
              { label: "Pending", value: "pending" },
              { label: "Unsubscribed", value: "unsubscribed" },
            ]}
          />
        )}
        {table.getColumn("source") && (
          <DataTableFacetedFilter
            column={table.getColumn("source")}
            title="Source"
            options={[
              { label: "Self-signup", value: "self_signup" },
              { label: "Vendor", value: "vendor" },
              { label: "Import", value: "import" },
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
    </div>
  );
}
