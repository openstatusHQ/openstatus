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
import { entityKinds } from "@/data/entity-refs.client";
import {
  type BreakdownRow,
  type HistoryEvent,
  type HistoryExcusedOutage,
  type HistoryMaintenanceWindow,
  type HistoryUnit,
  type HistoryValue,
  historyBreakdown,
} from "@/data/status-page-history";
import { truncatePercentage } from "@/lib/formatter";
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
    return `/monitors/${monitorId}/report#outages`;
  }
  return null;
}

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
  isCurrent,
}: {
  value: HistoryValue;
  unit: HistoryUnit;
  isCurrent?: boolean;
}) {
  const { rows, total } = historyBreakdown(value, unit);
  return (
    <div className="grid gap-1.5">
      <div className={tooltipRowClassName}>
        <ChartTooltipNumberRaw
          label="Uptime"
          value={truncatePercentage(value.percentage)}
          unit="%"
          className={isCurrent ? "bg-info" : "bg-foreground"}
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
function EventItem({
  name,
  from,
  to,
  indicatorClassName,
}: {
  name: string;
  from: Date;
  to: Date | null;
  indicatorClassName: string;
}) {
  const duration = to ? formatDistanceStrict(from, to) : "ongoing";
  return (
    <div className="text-muted-foreground group-hover/event:text-foreground grid gap-0.5">
      <div className="flex items-center gap-2">
        <span
          className={cn("size-2.5 shrink-0 rounded-xs", indicatorClassName)}
        />
        <span className="truncate">{name}</span>
      </div>
      <div className="text-muted-foreground">
        <span>{formatDateRange(from, to ?? undefined)}</span>
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
  events = [],
  maintenanceWindows = [],
  excusedOutages = [],
  monitorId = null,
}: {
  value: HistoryValue | null;
  unit: HistoryUnit;
  /** card header: the month, or the window of a total */
  label: string;
  isCurrent?: boolean;
  events?: HistoryEvent[];
  /** dashboard-only, never on the public page */
  maintenanceWindows?: HistoryMaintenanceWindow[];
  /** left out of the numbers */
  excusedOutages?: HistoryExcusedOutage[];
  monitorId?: number | null;
}) {
  const { id: pageId } = useParams<{ id: string }>();

  return (
    <HoverCard openDelay={50} closeDelay={50}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          className={cn(
            "mx-auto flex h-9 cursor-default items-center justify-center font-mono text-xs font-medium",
            value === null
              ? "text-muted-foreground/50"
              : isCurrent && "text-info",
          )}
        >
          {value === null ? "–" : `${truncatePercentage(value.percentage)}%`}
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
          <Breakdown value={value} unit={unit} isCurrent={isCurrent} />
        )}
        {events.length > 0 && (
          <>
            <div className="bg-border -mx-2.5 h-px" />
            <div className="grid gap-1">
              {events.map((event) => {
                const key = `${event.type}-${event.id}`;
                const href = eventHref(event, pageId, monitorId);
                const node = (
                  <EventItem
                    name={event.name}
                    from={event.from}
                    to={event.to}
                    indicatorClassName={eventIndicatorStyles[event.type]}
                  />
                );
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
        {maintenanceWindows.length + excusedOutages.length > 0 && (
          <>
            <div className="bg-border -mx-2.5 h-px" />
            <div className="grid gap-1">
              {maintenanceWindows.map((w) => (
                <Link
                  key={`window-${w.id}`}
                  href={entityKinds.maintenanceWindow.href()}
                  className="group/event hover:no-underline"
                >
                  <EventItem
                    name={`Maintenance window · ${w.title}`}
                    from={w.from}
                    to={w.to}
                    indicatorClassName="bg-info/50"
                  />
                </Link>
              ))}
              {excusedOutages.map((o) => (
                <EventItem
                  key={`excused-${o.id}`}
                  name={o.reason ? `Excused · ${o.reason}` : "Excused"}
                  from={o.from}
                  to={o.to}
                  indicatorClassName="bg-muted-foreground/40"
                />
              ))}
            </div>
          </>
        )}
      </HoverCardContent>
    </HoverCard>
  );
}
