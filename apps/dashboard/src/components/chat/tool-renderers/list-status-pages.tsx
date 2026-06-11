import type { AgentToolOutput } from "@openstatus/services/agent-tools";

import { TableCellLink } from "@/components/data-table/table-cell-link";
import { TableCellNumber } from "@/components/data-table/table-cell-number";
import { TableCellText } from "@/components/data-table/table-cell-text";

import type { ResultTableData } from "./result-table";

type Output = AgentToolOutput<"list_status_pages">;

export function listStatusPagesTable(
  output: Output,
): ResultTableData<"title" | "slug" | "id"> {
  const items = output?.items ?? [];
  return {
    empty: "No status pages.",
    columns: [
      { key: "title", header: "Title" },
      { key: "slug", header: "Slug" },
      { key: "id", header: "ID" },
    ],
    rows: items.map((p) => ({
      id: p.id,
      cells: {
        title: (
          <TableCellLink
            href={`/status-pages/${p.id}/status-reports`}
            value={p.title}
          />
        ),
        slug: (
          <TableCellText
            value={p.slug}
            className="text-muted-foreground font-mono"
          />
        ),
        id: <TableCellNumber value={p.id} />,
      },
    })),
  };
}
