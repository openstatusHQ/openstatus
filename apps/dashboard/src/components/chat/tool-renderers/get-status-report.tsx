import type { AgentToolOutput } from "@openstatus/services/agent-tools";
import { cn } from "@openstatus/ui/lib/utils";

import { TableCellDate } from "@/components/data-table/table-cell-date";
import { TableCellLink } from "@/components/data-table/table-cell-link";
import { TableCellNumber } from "@/components/data-table/table-cell-number";
import { TableCellText } from "@/components/data-table/table-cell-text";
import { colors } from "@/data/status-report-updates.client";

import type { DetailsTableData } from "./details-table";

function Status({ value }: { value: string }) {
  return (
    <div
      className={cn(
        "font-mono capitalize",
        colors[value as keyof typeof colors],
      )}
    >
      {value}
    </div>
  );
}

export function getStatusReportDetails(
  output: AgentToolOutput<"get_status_report">,
): DetailsTableData {
  return {
    sections: [
      {
        rows: [
          { label: "ID", value: <TableCellNumber value={output.id} /> },
          {
            label: "Title",
            value:
              output.pageId !== null ? (
                <TableCellLink
                  href={`/status-pages/${output.pageId}/status-reports/${output.id}`}
                  value={output.title}
                />
              ) : (
                <TableCellText value={output.title} />
              ),
          },
          { label: "Status", value: <Status value={output.status} /> },
          {
            label: "Page",
            value:
              output.pageId !== null ? (
                <TableCellNumber value={output.pageId} />
              ) : (
                <TableCellText value={null} />
              ),
          },
        ],
      },
      {
        title: "Timeline",
        rows: output.updates.map((u) => ({
          label: `#${u.id}`,
          value: (
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <Status value={u.status} />
                {u.date ? <TableCellDate value={new Date(u.date)} /> : null}
              </div>
              <TableCellText value={u.message} />
            </div>
          ),
        })),
      },
    ],
  };
}
