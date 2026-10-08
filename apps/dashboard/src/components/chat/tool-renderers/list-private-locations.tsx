import type { AgentToolOutput } from "@openstatus/services/agent-tools";

import { TableCellDate } from "@/components/data-table/table-cell-date";
import { TableCellLink } from "@/components/data-table/table-cell-link";
import { TableCellMetadata } from "@/components/data-table/table-cell-metadata";
import { TableCellNumber } from "@/components/data-table/table-cell-number";
import { TableCellText } from "@/components/data-table/table-cell-text";

import type { ResultTableData } from "./result-table";

type Output = AgentToolOutput<"list_private_locations">;

export function listPrivateLocationsTable(
  output: Output,
): ResultTableData<"name" | "monitors" | "metadata" | "lastSeenAt" | "id"> {
  const items = output?.items ?? [];
  return {
    empty: "No private locations.",
    columns: [
      { key: "name", header: "Name" },
      { key: "monitors", header: "Monitors" },
      { key: "metadata", header: "Metadata" },
      { key: "lastSeenAt", header: "Last seen" },
      { key: "id", header: "ID" },
    ],
    rows: items.map((location) => ({
      id: location.id,
      cells: {
        name: (
          <TableCellLink
            href={"/settings/private-locations"}
            value={location.name}
          />
        ),
        monitors: (
          <TableCellText
            value={
              location.monitorIds.length === 0
                ? "none"
                : `${location.monitorIds.length} (${location.monitorIds.join(", ")})`
            }
            className="text-muted-foreground font-mono"
          />
        ),
        metadata: <TableCellMetadata value={location.metadata} />,
        lastSeenAt: location.lastSeenAt ? (
          <TableCellDate value={new Date(location.lastSeenAt)} />
        ) : (
          <TableCellText value="never" className="text-muted-foreground" />
        ),
        id: <TableCellNumber value={location.id} />,
      },
    })),
  };
}
