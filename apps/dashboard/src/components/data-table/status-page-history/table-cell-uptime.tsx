import { StatusBarEvent } from "@openstatus/ui/components/blocks/status-bar";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@openstatus/ui/components/ui/hover-card";
import { Separator } from "@openstatus/ui/components/ui/separator";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Fragment } from "react";

import {
  type HistoryEvent,
  type UptimeStatus,
  cellFromPercentage,
} from "@/data/status-page-history";
import { cn } from "@/lib/utils";

// maintenances have no detail route (sheet-edited on the list page);
// incidents would need the monitor id — left unlinked like the status page
function eventHref(event: HistoryEvent, pageId: string): string | null {
  if (event.type === "report") {
    return `/status-pages/${pageId}/status-reports/${event.id}`;
  }
  if (event.type === "maintenance") {
    return `/status-pages/${pageId}/maintenances`;
  }
  return null;
}

const statusStyles: Record<UptimeStatus, string> = {
  operational: "text-success",
  degraded: "text-warning",
  down: "text-destructive",
  "in-progress": "text-info",
  "no-data": "text-muted-foreground/50",
};

const indicatorStyles: Record<UptimeStatus, string> = {
  operational: "bg-success",
  degraded: "bg-warning",
  down: "bg-destructive",
  "in-progress": "bg-info",
  "no-data": "bg-muted-foreground/30",
};

const statusLabels: Record<UptimeStatus, string> = {
  operational: "Operational",
  degraded: "Degraded",
  down: "Down",
  "in-progress": "In progress",
  "no-data": "No data",
};

export function TableCellUptime({
  percentage,
  isCurrent,
  monthLabel,
  events = [],
}: {
  percentage: number | null;
  isCurrent?: boolean;
  monthLabel: string;
  events?: HistoryEvent[];
}) {
  const { id: pageId } = useParams<{ id: string }>();
  const cell = cellFromPercentage(percentage, isCurrent);

  return (
    <HoverCard openDelay={50} closeDelay={50}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          className={cn(
            "mx-auto flex h-9 cursor-default items-center justify-center font-mono text-xs font-medium",
            statusStyles[cell.status],
          )}
        >
          {cell.percentage === null ? "–" : `${cell.percentage.toFixed(2)}%`}
        </button>
      </HoverCardTrigger>
      <HoverCardContent
        align="center"
        className="border-border/50 grid w-auto max-w-[18rem] min-w-[12rem] gap-1.5 rounded-lg p-0 px-2.5 py-1.5 text-xs shadow-xl"
      >
        <div className="flex items-center justify-between gap-4 font-medium">
          <span>{monthLabel}</span>
        </div>
        {cell.percentage === null ? (
          <div className="text-muted-foreground">
            No data recorded for {monthLabel}.
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "size-2.5 shrink-0 rounded-[2px]",
                indicatorStyles[cell.status],
              )}
            />
            <span>{statusLabels[cell.status]}</span>
            <span className="text-foreground ml-auto flex items-baseline gap-0.5 font-mono font-medium tabular-nums">
              {cell.percentage.toFixed(2)}
              <span className="text-muted-foreground font-normal">%</span>
            </span>
          </div>
        )}
        {events.length > 0 && (
          <>
            <Separator className="-mx-2.5 w-auto" />
            <div className="grid gap-1">
              {events.map((event) => {
                const key = `${event.type}-${event.id}`;
                const href = eventHref(event, pageId);
                const node = (
                  <StatusBarEvent
                    type={event.type}
                    name={event.name}
                    from={event.from}
                    to={event.to}
                  />
                );
                if (!href) return <Fragment key={key}>{node}</Fragment>;
                return (
                  <Link key={key} href={href}>
                    {node}
                  </Link>
                );
              })}
            </div>
          </>
        )}
      </HoverCardContent>
    </HoverCard>
  );
}
