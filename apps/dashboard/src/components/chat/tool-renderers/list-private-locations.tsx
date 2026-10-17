import type { AgentToolOutput } from "@openstatus/services/agent-tools";

import { EntityRefList } from "@/components/common/entity-ref/entity-ref";
import { TableCellDate } from "@/components/data-table/table-cell-date";
import { TableCellEmpty } from "@/components/data-table/table-cell-empty";
import { TableCellLink } from "@/components/data-table/table-cell-link";
import { TableCellMetadata } from "@/components/data-table/table-cell-metadata";
import { TableCellNumber } from "@/components/data-table/table-cell-number";
import { TableCellText } from "@/components/data-table/table-cell-text";
import { entityKinds } from "@/data/entity-refs.client";

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
            href={entityKinds.privateLocation.href()}
            value={location.name}
          />
        ),
        monitors:
          location.monitorIds.length === 0 ? (
            <TableCellText value={null} empty="None" />
          ) : (
            <EntityRefList kind="monitor" refs={location.monitorIds} />
          ),
        metadata: <TableCellMetadata value={location.metadata} />,
        lastSeenAt: location.lastSeenAt ? (
          <TableCellDate value={new Date(location.lastSeenAt)} />
        ) : (
          <TableCellEmpty>Never</TableCellEmpty>
        ),
        id: <TableCellNumber value={location.id} />,
      },
    })),
  };
}
