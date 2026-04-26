"use client";

import { DataTableFacetedFilter } from "@/components/ui/data-table/data-table-faceted-filter";
import type { RouterOutputs } from "@openstatus/api";
import { Button } from "@openstatus/ui/components/ui/button";
import type { Table } from "@tanstack/react-table";
import { Database, User, X, Zap } from "lucide-react";

type AuditLog = RouterOutputs["auditLog"]["list"]["items"][number];

const ACTOR_TYPE_LABELS: Record<string, string> = {
  user: "User",
  apiKey: "API Key",
  slack: "Slack",
  system: "System",
  subscriber: "Subscriber",
};

function toOptions(values: Iterable<string>, labels?: Record<string, string>) {
  return Array.from(new Set(values))
    .filter(Boolean)
    .sort()
    .map((value) => ({ label: labels?.[value] ?? value, value }));
}

export function AuditLogsDataTableToolbar({
  table,
}: {
  table: Table<AuditLog>;
}) {
  const isFiltered = table.getState().columnFilters.length > 0;

  const actionFacets = table.getColumn("action")?.getFacetedUniqueValues();
  const actorTypeFacets = table
    .getColumn("actorType")
    ?.getFacetedUniqueValues();
  const entityTypeFacets = table
    .getColumn("entityType")
    ?.getFacetedUniqueValues();

  const actionOptions = toOptions(actionFacets?.keys() ?? []);
  const actorTypeOptions = toOptions(
    actorTypeFacets?.keys() ?? [],
    ACTOR_TYPE_LABELS,
  );
  const entityTypeOptions = toOptions(entityTypeFacets?.keys() ?? []);

  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-1 flex-wrap items-center gap-2">
        {table.getColumn("actorType") && actorTypeOptions.length > 0 && (
          <DataTableFacetedFilter
            column={table.getColumn("actorType")}
            title="Actor type"
            options={actorTypeOptions}
            icon={User}
          />
        )}
        {table.getColumn("action") && actionOptions.length > 0 && (
          <DataTableFacetedFilter
            column={table.getColumn("action")}
            title="Action"
            options={actionOptions}
            icon={Zap}
          />
        )}
        {table.getColumn("entityType") && entityTypeOptions.length > 0 && (
          <DataTableFacetedFilter
            column={table.getColumn("entityType")}
            title="Entity type"
            options={entityTypeOptions}
            icon={Database}
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
