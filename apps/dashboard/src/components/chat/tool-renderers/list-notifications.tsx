import type { AgentToolOutput } from "@openstatus/services/agent-tools";

import { TableCellLink } from "@/components/data-table/table-cell-link";
import { TableCellNumber } from "@/components/data-table/table-cell-number";
import { TableCellText } from "@/components/data-table/table-cell-text";

import type { ResultTableData } from "./result-table";

type Output = AgentToolOutput<"list_notifications">;

export function listNotificationsTable(
  output: Output,
): ResultTableData<"name" | "provider" | "monitors" | "id"> {
  const items = output?.items ?? [];
  return {
    empty: "No notification channels.",
    columns: [
      { key: "name", header: "Name" },
      { key: "provider", header: "Provider" },
      { key: "monitors", header: "Monitors" },
      { key: "id", header: "ID" },
    ],
    rows: items.map((n) => ({
      id: n.id,
      cells: {
        name: <TableCellLink href={`/notifications/${n.id}`} value={n.name} />,
        provider: (
          <TableCellText
            value={n.provider}
            className="font-mono text-muted-foreground"
          />
        ),
        monitors: (
          <TableCellText
            value={
              n.monitorIds.length === 0
                ? "none"
                : `${n.monitorIds.length} (${n.monitorIds.join(", ")})`
            }
            className="font-mono text-muted-foreground"
          />
        ),
        id: <TableCellNumber value={n.id} />,
      },
    })),
  };
}
