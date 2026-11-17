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

import { ChartTooltipNumberRaw } from "@/components/chart/chart-tooltip-number";
import {
  type BreakdownRow,
  type HistoryEvent,
  type HistoryUnit,
  type HistoryValue,
  type UptimeStatus,
  cellFromPercentage,
  historyBreakdown,
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

// the monitor overview's uptime chart colors
const breakdownStyles: Record<BreakdownRow["key"], string> = {
  ok: "bg-success",
  degraded: "bg-warning",
  error: "bg-destructive",
};

const tooltipRowClassName = "flex w-full flex-wrap items-center gap-2";

function Breakdown({
  value,
  unit,
  status,
}: {
  value: HistoryValue;
  unit: HistoryUnit;
  status: UptimeStatus;
}) {
  const { rows, total } = historyBreakdown(value, unit);
  return (
    <div className="grid gap-1.5">
      <div className={tooltipRowClassName}>
        <ChartTooltipNumberRaw
          label="Uptime"
          value={value.percentage.toFixed(3)}
          unit="%"
          className={indicatorStyles[status]}
        />
      </div>
      {rows.map((row) => (
        <div key={row.key} className={tooltipRowClassName}>
          <ChartTooltipNumberRaw
            label={row.label}
            value={row.value}
            unit={null}
            className={breakdownStyles[row.key]}
          />
        </div>
      ))}
      <div className={tooltipRowClassName}>
        <ChartTooltipNumberRaw
          label="Total"
          value={total.value}
          unit={total.unit}
          className="text-foreground flex h-0 basis-full items-center border-t text-xs font-medium"
        />
      </div>
    </div>
  );
}

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
            "size-2.5 shrink-0 rounded-xs",
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
  value,
  unit,
  label,
  isCurrent,
  tinted = true,
  events = [],
  monitorId = null,
}: {
  value: HistoryValue | null;
  unit: HistoryUnit;
  /** card header: the month, or the window of a total */
  label: string;
  isCurrent?: boolean;
  /** colors the cell by status; window totals stay neutral */
  tinted?: boolean;
  events?: HistoryEvent[];
  monitorId?: number | null;
}) {
  const { id: pageId } = useParams<{ id: string }>();
  const cell = cellFromPercentage(value?.percentage ?? null, isCurrent);

  return (
    <HoverCard openDelay={50} closeDelay={50}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          className={cn(
            "mx-auto flex h-9 cursor-default items-center justify-center font-mono text-xs font-medium",
            tinted && statusStyles[cell.status],
          )}
        >
          {cell.percentage === null ? "–" : `${cell.percentage.toFixed(3)}%`}
        </button>
      </HoverCardTrigger>
      <HoverCardContent
        align="center"
        className="border-border/50 grid w-auto max-w-[20rem] min-w-[12rem] gap-1.5 rounded-lg p-0 px-2.5 py-1.5 text-xs shadow-xl"
      >
        <div className="flex items-center justify-between gap-4 font-medium">
          <span>{label}</span>
        </div>
        {value === null ? (
          <div className="text-muted-foreground">No data recorded.</div>
        ) : (
          <Breakdown value={value} unit={unit} status={cell.status} />
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
                  <Link
                    key={key}
                    href={href}
                    className="group/event hover:no-underline"
                  >
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
