import type { AgentToolOutput } from "@openstatus/services/agent-tools";

import { TableCellBoolean } from "@/components/data-table/table-cell-boolean";
import { TableCellLink } from "@/components/data-table/table-cell-link";
import { TableCellNumber } from "@/components/data-table/table-cell-number";
import { TableCellText } from "@/components/data-table/table-cell-text";

import type { ResultTableData } from "./result-table";

type Output = AgentToolOutput<"list_monitors">;

export function listMonitorsTable(
  output: Output,
): ResultTableData<
  "name" | "jobType" | "periodicity" | "regions" | "active" | "id"
> {
  const items = output?.items ?? [];
  return {
    empty: "No monitors.",
    columns: [
      { key: "name", header: "Name" },
      { key: "jobType", header: "Type" },
      { key: "periodicity", header: "Periodicity" },
      { key: "regions", header: "Regions" },
      { key: "active", header: "Active" },
      { key: "id", header: "ID" },
    ],
    rows: items.map((m) => ({
      id: m.id,
      cells: {
        name: (
          <TableCellLink href={`/monitors/${m.id}/overview`} value={m.name} />
        ),
        jobType: (
          <TableCellText
            value={m.jobType.toUpperCase()}
            className="font-mono text-muted-foreground"
          />
        ),
        periodicity: (
          <TableCellText
            value={m.periodicity}
            className="font-mono text-muted-foreground"
          />
        ),
        regions: (
          <TableCellText
            value={m.regions.join(", ") || "—"}
            className="font-mono text-muted-foreground"
          />
        ),
        active: <TableCellBoolean value={m.active} />,
        id: <TableCellNumber value={m.id} />,
      },
    })),
  };
}
