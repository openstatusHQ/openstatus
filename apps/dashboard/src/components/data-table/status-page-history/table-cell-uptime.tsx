import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@openstatus/ui/components/ui/hover-card";

import { cn } from "@/lib/utils";

import type { HistoryRow, MonthCell, UptimeStatus } from "./data";

const statusStyles: Record<UptimeStatus, string> = {
  operational: "text-success",
  degraded: "text-warning",
  down: "text-destructive",
  "in-progress": "text-info",
};

const indicatorStyles: Record<UptimeStatus, string> = {
  operational: "bg-success",
  degraded: "bg-warning",
  down: "bg-destructive",
  "in-progress": "bg-info",
};

const statusLabels: Record<UptimeStatus, string> = {
  operational: "Operational",
  degraded: "Degraded",
  down: "Down",
  "in-progress": "In progress",
};

export function TableCellUptime({
  cell,
  isCurrent,
  monthLabel,
  component,
}: {
  cell: MonthCell | undefined;
  isCurrent?: boolean;
  monthLabel: string;
  component: HistoryRow["component"];
}) {
  if (!cell) {
    // before the component existed: hatched placeholder
    return <div className="mx-auto h-9 w-[52px]" />;
  }

  const status = isCurrent ? "in-progress" : cell.status;

  return (
    <HoverCard openDelay={50} closeDelay={50}>
      <HoverCardTrigger asChild>
        <div
          className={cn(
            "mx-auto flex h-9 cursor-default items-center justify-center font-mono text-xs font-medium",
            statusStyles[status],
          )}
        >
          {cell.percentage.toFixed(2)}%
        </div>
      </HoverCardTrigger>
      <HoverCardContent
        align="center"
        className="border-border/50 grid w-auto min-w-[12rem] gap-1.5 rounded-lg p-0 px-2.5 py-1.5 text-xs shadow-xl"
      >
        <div className="flex items-center justify-between gap-4 font-medium">
          <span>{monthLabel}</span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "size-2.5 shrink-0 rounded-[2px]",
              indicatorStyles[status],
            )}
          />
          <span>{statusLabels[status]}</span>
          <span className="text-foreground ml-auto flex items-baseline gap-0.5 font-mono font-medium tabular-nums">
            {cell.percentage.toFixed(2)}
            <span className="text-muted-foreground font-normal">%</span>
          </span>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
