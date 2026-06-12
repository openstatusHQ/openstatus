import type { AgentToolOutput } from "@openstatus/services/agent-tools";

import { TableCellLink } from "@/components/data-table/table-cell-link";
import { TableCellText } from "@/components/data-table/table-cell-text";

import type { ResultTableData } from "./result-table";

type Output = AgentToolOutput<"search_docs">;

export function searchDocsTable(
  output: Output,
): ResultTableData<"title" | "snippet"> {
  const results = output?.results ?? [];
  return {
    empty: output?.error ?? "No results.",
    columns: [
      { key: "title", header: "Title" },
      { key: "snippet", header: "Snippet" },
    ],
    rows: results.map((r) => ({
      id: r.path,
      cells: {
        title: <TableCellLink href={r.url} value={r.title} />,
        snippet: (
          <TableCellText value={r.snippet} className="text-muted-foreground" />
        ),
      },
    })),
  };
}
