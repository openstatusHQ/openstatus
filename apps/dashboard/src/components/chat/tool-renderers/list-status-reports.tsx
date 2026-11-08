import type { AgentToolOutput } from "@openstatus/services/agent-tools";
import { cn } from "@openstatus/ui/lib/utils";

import { EntityRef } from "@/components/common/entity-ref/entity-ref";
import { TableCellLink } from "@/components/data-table/table-cell-link";
import { TableCellNumber } from "@/components/data-table/table-cell-number";
import { TableCellText } from "@/components/data-table/table-cell-text";
import { entityKinds } from "@/data/entity-refs.client";
import { colors } from "@/data/status-report-updates.client";

import type { ResultTableData } from "./result-table";

type Output = AgentToolOutput<"list_status_reports">;

export function listStatusReportsTable(
  output: Output,
): ResultTableData<"title" | "status" | "page" | "id"> {
  const items = output?.items ?? [];
  return {
    empty: "No status reports.",
    columns: [
      { key: "title", header: "Title" },
      { key: "status", header: "Status" },
      { key: "page", header: "Page" },
      { key: "id", header: "ID" },
    ],
    rows: items.map((r) => ({
      id: r.id,
      cells: {
        title:
          r.pageId !== null ? (
            <TableCellLink
              href={entityKinds.statusReport.href({
                id: r.id,
                pageId: r.pageId,
              })}
              value={r.title}
            />
          ) : (
            <TableCellText value={r.title} />
          ),
        status: (
          <div
            className={cn(
              "font-mono capitalize",
              colors[r.status as keyof typeof colors],
            )}
          >
            {r.status}
          </div>
        ),
        page:
          r.pageId !== null ? (
            <EntityRef kind="page" id={r.pageId} />
          ) : (
            <TableCellText value={null} empty="No page" />
          ),
        id: <TableCellNumber value={r.id} />,
      },
    })),
  };
}
