import type { AgentToolOutput } from "@openstatus/services/agent-tools";
import { cn } from "@openstatus/ui/lib/utils";

import { TableCellRegion } from "@/components/data-table/table-cell-region";

import type { ResultTableData } from "./result-table";

type Output = AgentToolOutput<"get_monitor_status">;

const statusColor: Record<Output["regions"][number]["status"], string> = {
  active: "text-success",
  degraded: "text-warning",
  error: "text-destructive",
};

export function getMonitorStatusTable(
  output: Output,
): ResultTableData<"region" | "status"> {
  return {
    empty: "No regions reporting yet.",
    columns: [
      { key: "region", header: "Region" },
      { key: "status", header: "Status" },
    ],
    rows: output.regions.map((r) => ({
      id: r.region,
      cells: {
        region: <TableCellRegion value={r.region} className="font-mono" />,
        status: (
          <div className={cn("font-mono", statusColor[r.status])}>
            {r.status}
          </div>
        ),
      },
    })),
  };
}
