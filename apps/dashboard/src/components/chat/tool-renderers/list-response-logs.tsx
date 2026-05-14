import type { AgentToolOutput } from "@openstatus/services/agent-tools";
import { cn } from "@openstatus/ui/lib/utils";

import { HoverCardTiming } from "@/components/common/hover-card-timing";
import { TableCellDate } from "@/components/data-table/table-cell-date";
import { TableCellNumber } from "@/components/data-table/table-cell-number";
import { TableCellRegion } from "@/components/data-table/table-cell-region";
import { TableCellText } from "@/components/data-table/table-cell-text";
import { getStatusCodeVariant, textColors } from "@/data/status-codes";

import type { ResultTableData } from "./result-table";

type Output = AgentToolOutput<"list_response_logs">;
type Status = NonNullable<Output["logs"][number]["requestStatus"]>;

const statusColor: Record<Status, string> = {
  success: "bg-success",
  degraded: "bg-warning",
  error: "bg-destructive",
};

export function listResponseLogsTable(
  output: Output,
): ResultTableData<
  "indicator" | "timestamp" | "region" | "status" | "latency" | "timing" | "id"
> {
  const logs = output?.logs ?? [];
  return {
    empty: "No response logs in this window.",
    columns: [
      { key: "indicator", header: "" },
      { key: "timestamp", header: "Timestamp" },
      { key: "region", header: "Region" },
      { key: "status", header: "Status" },
      { key: "latency", header: "Latency" },
      { key: "timing", header: "Timing" },
      { key: "id", header: "ID" },
    ],
    rows: logs.map((log, idx) => ({
      id: log.id ?? `row-${idx}`,
      cells: {
        indicator: log.requestStatus ? (
          <div
            className={cn(
              "h-2.5 w-2.5 rounded-[2px]",
              statusColor[log.requestStatus],
            )}
          />
        ) : (
          <div className="text-muted-foreground">-</div>
        ),
        timestamp: (
          <TableCellDate
            value={new Date(log.timestamp)}
            className="font-mono text-foreground"
          />
        ),
        region: <TableCellRegion value={log.region} className="font-mono" />,
        status:
          log.statusCode != null ? (
            <TableCellNumber
              value={log.statusCode}
              className={textColors[getStatusCodeVariant(log.statusCode)]}
            />
          ) : (
            <TableCellText value="—" />
          ),
        latency: <TableCellNumber value={log.latency} unit="ms" />,
        timing: log.timing ? (
          <HoverCardTiming timing={log.timing} latency={log.latency} />
        ) : (
          <div className="text-muted-foreground">-</div>
        ),
        id: (
          <TableCellText
            value={log.id ?? "—"}
            className="font-mono text-muted-foreground"
          />
        ),
      },
    })),
  };
}
