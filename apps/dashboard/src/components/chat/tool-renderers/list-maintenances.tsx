import type { AgentToolOutput } from "@openstatus/services/agent-tools";
import { formatDistanceStrict } from "date-fns";

import { TableCellDate } from "@/components/data-table/table-cell-date";
import { TableCellNumber } from "@/components/data-table/table-cell-number";
import { TableCellText } from "@/components/data-table/table-cell-text";

import type { ResultTableData } from "./result-table";

type Output = AgentToolOutput<"list_maintenances">;

export function listMaintenancesTable(
  output: Output,
): ResultTableData<"title" | "from" | "duration" | "page" | "id"> {
  const items = output?.items ?? [];
  return {
    empty: "No maintenance windows.",
    columns: [
      { key: "title", header: "Title" },
      { key: "from", header: "Start" },
      { key: "duration", header: "Duration" },
      { key: "page", header: "Page" },
      { key: "id", header: "ID" },
    ],
    rows: items.map((m) => {
      const from = new Date(m.from);
      const to = new Date(m.to);
      const [amount, unit] = formatDistanceStrict(from, to).split(" ");
      return {
        id: m.id,
        cells: {
          title: <TableCellText value={m.title} />,
          from: <TableCellDate value={from} />,
          duration: <TableCellNumber value={amount} unit={unit} />,
          page:
            m.pageId !== null ? (
              <TableCellNumber value={m.pageId} />
            ) : (
              <TableCellText value={null} />
            ),
          id: <TableCellNumber value={m.id} />,
        },
      };
    }),
  };
}
