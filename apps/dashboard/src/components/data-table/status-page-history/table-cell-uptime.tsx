import { formatDateRange } from "@openstatus/ui/components/blocks/status.utils";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@openstatus/ui/components/ui/hover-card";
import { formatDistanceStrict } from "date-fns";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Fragment } from "react";

import {
  type HistoryEvent,
  type UptimeStatus,
  cellFromPercentage,
} from "@/data/status-page-history";
import { cn } from "@/lib/utils";

// maintenances have no detail route (sheet-edited on the list page)
function eventHref(
  event: HistoryEvent,
  pageId: string,
  monitorId: number | null,
): string | null {
  if (event.type === "report") {
    return `/status-pages/${pageId}/status-reports/${event.id}`;
  }
  if (event.type === "maintenance") {
    return `/status-pages/${pageId}/maintenances`;
  }
  if (event.type === "incident" && monitorId !== null) {
    return `/monitors/${monitorId}/incidents`;
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

const eventIndicatorStyles: Record<HistoryEvent["type"], string> = {
  incident: "bg-destructive",
  report: "bg-warning",
  maintenance: "bg-info",
};

// local copy of the status-page StatusBarEvent so dashboard tweaks
// don't leak into the public blocks
function EventItem({ event }: { event: HistoryEvent }) {
  if (!event.from) return null;
  const duration = event.to
    ? formatDistanceStrict(event.from, event.to)
    : "ongoing";
  return (
    <div className="text-muted-foreground group-hover/event:text-foreground grid gap-0.5">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "size-2.5 shrink-0 rounded-[2px]",
            eventIndicatorStyles[event.type],
          )}
        />
        <span className="truncate">{event.name}</span>
      </div>
      <div className="text-muted-foreground">
        <span>{formatDateRange(event.from, event.to ?? undefined)}</span>
        {duration !== "0 seconds" && (
          <span className="text-muted-foreground/70 ml-1.5 font-mono">
            {duration}
          </span>
        )}
      </div>
    </div>
  );
}

export function TableCellUptime({
  percentage,
  isCurrent,
  monthLabel,
  events = [],
  monitorId = null,
}: {
  percentage: number | null;
  isCurrent?: boolean;
  monthLabel: string;
  events?: HistoryEvent[];
  monitorId?: number | null;
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
        className="border-border/50 grid w-auto max-w-[20rem] min-w-[12rem] gap-1.5 rounded-lg p-0 px-2.5 py-1.5 text-xs shadow-xl"
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
            <span>Uptime</span>
            <span className="text-foreground ml-auto flex items-baseline gap-0.5 font-mono font-medium tabular-nums">
              {cell.percentage.toFixed(2)}
              <span className="text-muted-foreground font-normal">%</span>
            </span>
          </div>
        )}
        {events.length > 0 && (
          <>
            <div className="bg-border -mx-2.5 h-px" />
            <div className="grid gap-1">
              {events.map((event) => {
                const key = `${event.type}-${event.id}`;
                const href = eventHref(event, pageId, monitorId);
                const node = <EventItem event={event} />;
                if (!href) return <Fragment key={key}>{node}</Fragment>;
                return (
                  <Link key={key} href={href} className="group/event">
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
