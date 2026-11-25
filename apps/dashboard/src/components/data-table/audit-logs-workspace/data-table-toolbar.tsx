"use client";

import type { RouterOutputs } from "@openstatus/api";
import { Database, Account, Close, Speed } from "@openstatus/icons";
import { Button } from "@openstatus/ui/components/ui/button";
import type { Table } from "@tanstack/react-table";

import { DataTableFacetedFilter } from "@/components/ui/data-table/data-table-faceted-filter";

type AuditLog = RouterOutputs["auditLog"]["list"]["items"][number];

const ACTOR_TYPE_LABELS: Record<string, string> = {
  user: "User",
  apiKey: "API Key",
  slack: "Slack",
  system: "System",
  subscriber: "Subscriber",
  mcp: "MCP",
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
            icon={Account}
          />
        )}
        {table.getColumn("action") && actionOptions.length > 0 && (
          <DataTableFacetedFilter
            column={table.getColumn("action")}
            title="Action"
            options={actionOptions}
            icon={Speed}
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
            <Close />
          </Button>
        )}
      </div>
    </div>
  );
}
