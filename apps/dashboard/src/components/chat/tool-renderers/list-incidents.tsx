import type { AgentToolOutput } from "@openstatus/services/agent-tools";

import { TableCellLink } from "@/components/data-table/table-cell-link";
import { TableCellNumber } from "@/components/data-table/table-cell-number";
import { TableCellText } from "@/components/data-table/table-cell-text";

import type { ResultTableData } from "./result-table";

type Output = AgentToolOutput<"list_incidents">;

export function listIncidentsTable(
  output: Output,
): ResultTableData<"title" | "status" | "severity" | "origin" | "id"> {
  const items = output?.items ?? [];
  return {
    empty: "No incidents.",
    columns: [
      { key: "title", header: "Title" },
      { key: "status", header: "Status" },
      { key: "severity", header: "Severity" },
      { key: "origin", header: "Origin" },
      { key: "id", header: "ID" },
    ],
    rows: items.map((incident) => ({
      id: incident.id,
      cells: {
        title: (
          <TableCellLink
            href={`/incidents/${incident.id}`}
            value={incident.title}
          />
        ),
        status: <TableCellText value={incident.status} />,
        severity: <TableCellText value={incident.severity} />,
        origin: <TableCellText value={incident.origin} />,
        id: <TableCellNumber value={incident.id} />,
      },
    })),
  };
}
