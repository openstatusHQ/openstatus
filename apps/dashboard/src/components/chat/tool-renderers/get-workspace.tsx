import type { AgentToolOutput } from "@openstatus/services/agent-tools";

import { TableCellDate } from "@/components/data-table/table-cell-date";
import { TableCellNumber } from "@/components/data-table/table-cell-number";
import { TableCellText } from "@/components/data-table/table-cell-text";

import type { DetailsTableData } from "./details-table";

type Output = AgentToolOutput<"get_workspace">;

export function getWorkspaceDetails(output: Output): DetailsTableData {
  const { usage } = output;
  return {
    sections: [
      {
        title: "Workspace",
        rows: [
          { label: "Name", value: <TableCellText value={output.name} /> },
          { label: "Slug", value: <TableCellText value={output.slug} /> },
          { label: "Plan", value: <TableCellText value={output.plan} /> },
          {
            label: "Trial ends",
            value: (
              <TableCellDate
                value={output.trialEndsAt ? new Date(output.trialEndsAt) : null}
              />
            ),
          },
        ],
      },
      {
        title: "Usage",
        rows: [
          {
            label: "Monitors",
            value: <TableCellNumber value={usage.monitors} />,
          },
          {
            label: "Status pages",
            value: <TableCellNumber value={usage.statusPages} />,
          },
          {
            label: "Page components",
            value: <TableCellNumber value={usage.pageComponents} />,
          },
          {
            label: "Notification channels",
            value: <TableCellNumber value={usage.notificationChannels} />,
          },
          {
            label: "Status reports",
            value: <TableCellNumber value={usage.statusReports} />,
          },
        ],
      },
    ],
  };
}
