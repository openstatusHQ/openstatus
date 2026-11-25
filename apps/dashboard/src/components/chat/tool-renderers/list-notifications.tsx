import type { AgentToolOutput } from "@openstatus/services/agent-tools";

import { EntityRefList } from "@/components/common/entity-ref/entity-ref";
import { TableCellLink } from "@/components/data-table/table-cell-link";
import { TableCellNumber } from "@/components/data-table/table-cell-number";
import { TableCellText } from "@/components/data-table/table-cell-text";
import { entityKinds } from "@/data/entity-refs.client";

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
        name: (
          <TableCellLink
            href={entityKinds.notification.href()}
            value={n.name}
          />
        ),
        provider: (
          <TableCellText
            value={n.provider}
            className="text-muted-foreground font-mono"
          />
        ),
        monitors:
          n.monitorIds.length === 0 ? (
            <TableCellText value={null} empty="None" />
          ) : (
            <EntityRefList kind="monitor" refs={n.monitorIds} />
          ),
        id: <TableCellNumber value={n.id} />,
      },
    })),
  };
}
