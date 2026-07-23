import type { AgentToolOutput } from "@openstatus/services/agent-tools";
import { Badge } from "@openstatus/ui/components/ui/badge";

import { TableCellDate } from "@/components/data-table/table-cell-date";
import { TableCellText } from "@/components/data-table/table-cell-text";
import { cn } from "@/lib/utils";

import type { ResultTableData } from "./result-table";

type Output = AgentToolOutput<"list_audit_logs">;

function getActionBadgeColor(action: string) {
  if (action.endsWith(".create"))
    return "bg-success/10 text-success border-success/20";
  if (action.endsWith(".update")) return "bg-info/10 text-info border-info/20";
  if (action.endsWith(".delete"))
    return "bg-destructive/10 text-destructive border-destructive/20";
  return "bg-muted/10 text-muted-foreground border-muted/20";
}

export function listAuditLogsTable(
  output: Output,
): ResultTableData<"action" | "entity" | "actor" | "createdAt"> {
  const items = output.items;
  return {
    empty: "No audit log entries.",
    columns: [
      { key: "action", header: "Action" },
      { key: "entity", header: "Entity" },
      { key: "actor", header: "Actor" },
      { key: "createdAt", header: "Timestamp" },
    ],
    rows: items.map((item) => ({
      id: item.id,
      cells: {
        action: (
          <Badge
            variant="outline"
            className={cn(
              "font-mono text-xs",
              getActionBadgeColor(item.action),
            )}
          >
            {item.action}
          </Badge>
        ),
        entity: (
          <TableCellText
            value={`${item.entityType}#${item.entityId}`}
            className="text-muted-foreground font-mono"
          />
        ),
        actor: (
          <TableCellText
            value={item.actor}
            className="text-muted-foreground font-mono"
          />
        ),
        createdAt: (
          <TableCellDate
            value={new Date(item.createdAt)}
            className="font-mono"
          />
        ),
      },
    })),
  };
}
