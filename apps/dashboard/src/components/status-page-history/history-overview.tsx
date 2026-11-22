"use client";

import { Calendar } from "@openstatus/icons";
import {
  StatusCalendar,
  type StatusCalendarMarker,
} from "@openstatus/ui/components/blocks/status-calendar";
import { Badge } from "@openstatus/ui/components/ui/badge";
import { cn } from "@openstatus/ui/lib/utils";
import { eachDayOfInterval, format, startOfDay } from "date-fns";
import { useMemo } from "react";

import {
  Activity,
  ActivityHeader,
  ActivityPeriod,
  ActivityTitle,
} from "@/components/content/activity";
import { ComponentListName } from "@/components/content/component-list";
import {
  EmptyStateDescription,
  EmptyStateMedia,
  EmptyStateTitle,
} from "@/components/content/empty-state";
import {
  EventGroup,
  EventGroupCount,
  EventGroupEmpty,
  EventGroupHeader,
  EventGroupHint,
  EventGroupTitle,
} from "@/components/content/event-group";
import { EventList, EventRow } from "@/components/content/event-list";
import {
  MetricStrip,
  MetricStripAside,
  MetricStripButton,
  MetricStripItem,
  MetricStripLabel,
  MetricStripRow,
  MetricStripValue,
} from "@/components/metric/metric-strip";
import {
  type HistoryEvent,
  type HistoryItem,
  type HistoryRow,
  downtimeMinutes,
  eventsForMonth,
  historyItemKey,
  historyItemKind,
  historyItems,
  monthKeyToFullLabel,
  pageMonthUptime,
} from "@/data/status-page-history";
import type { UptimeMode } from "@/data/uptime-calculation.client";
import {
  formatDurationShort,
  formatNumber,
  inTimeZone,
  truncatePercentage,
} from "@/lib/formatter";

import {
  HistoryItemLegend,
  HistoryItemRow,
  historyItemDot,
} from "./history-item-row";

const pct = (v: number | null | undefined) =>
  v === null || v === undefined ? "–" : `${truncatePercentage(v)}%`;

// counted checks only translate to time as an estimate of the month
const formatDowntime = (minutes: number | null, estimate = false) =>
  minutes === null
    ? "–"
    : `${estimate && minutes > 0 ? "~" : ""}${formatDurationShort(minutes * 60_000)}`;

function monthDate(key: string): Date {
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month - 1, 1);
}

/** Neutral bars: we don't know the customer's target, so height is the only signal. */
function DowntimeBars({
  values,
  selected,
  className,
  style,
}: {
  values: (number | null)[];
  selected: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const max = Math.max(1, ...values.map((v) => v ?? 0));
  return (
    <span
      aria-hidden
      className={cn("flex items-end gap-px", className)}
      style={style}
    >
      {values.map((v, i) =>
        v === null ? (
          <span
            key={i}
            className="border-border flex-1 border-b border-dashed"
          />
        ) : (
          <span
            key={i}
            className={cn(
              "flex-1 rounded-[1px]",
              i === selected ? "bg-foreground/70" : "bg-foreground/15",
            )}
            style={{ height: `${Math.max(8, (v / max) * 100)}%` }}
          />
        ),
      )}
    </span>
  );
}

// a resolved report carries "success", but history shows what happened, not the end state
const markerStatus = (event: HistoryEvent): StatusCalendarMarker["status"] =>
  event.type === "report" && event.status !== "error"
    ? "degraded"
    : event.status;

function toMarkers(
  items: HistoryItem[],
  timeZone: string,
): StatusCalendarMarker[] {
  // the calendar buckets by local day, so hand it the zone's calendar day
  const zoneDay = (date: Date) => startOfDay(inTimeZone(date, timeZone));
  return items.flatMap((item) => {
    const days = eachDayOfInterval({
      start: zoneDay(item.from),
      end: zoneDay(item.to ?? new Date()),
    });
    const where = item.components.join(", ");
    return days.map((date) =>
      item.kind === "excused"
        ? {
            id: `${historyItemKey(item)}-${date.getTime()}`,
            date,
            status: "empty" as const,
            type: "incident" as const,
            name: `Excused · ${where}`,
            from: item.from,
            to: item.to,
            hatched: true,
          }
        : item.kind === "window"
          ? {
              id: `${historyItemKey(item)}-${date.getTime()}`,
              date,
              status: "info" as const,
              type: "maintenance" as const,
              hatched: true,
              name: `Window · ${item.window.title} · ${where}`,
              from: item.from,
              to: item.to,
            }
          : {
              id: `${historyItemKey(item)}-${date.getTime()}`,
              date,
              status: markerStatus(item.event),
              type: item.event.type,
              name: `${item.event.name} · ${where}`,
              from: item.from,
              to: item.to,
            },
    );
  });
}

export function HistoryOverview({
  rows,
  months,
  month,
  onMonthChange,
  timeZone,
  uptime,
  mode,
  isPreview,
}: {
  rows: HistoryRow[];
  /** oldest first, the last one in progress */
  months: string[];
  /** YYYY-MM to show; null or outside `months`, the latest */
  month: string | null;
  onMonthChange: (month: string | null) => void;
  timeZone: string;
  uptime: number | null;
  mode: UptimeMode;
  isPreview: boolean;
}) {
  const desc = useMemo(() => months.toReversed(), [months]);
  const selected = month && months.includes(month) ? month : desc[0];
  // the month in progress drops out of the URL
  const setSelected = (key: string) =>
    onMonthChange(key === desc[0] ? null : key);
  const items = useMemo(() => historyItems(rows), [rows]);
  const markers = useMemo(() => toMarkers(items, timeZone), [items, timeZone]);
  const pageDowns = desc.map((key) =>
    downtimeMinutes(pageMonthUptime(rows, key), key, timeZone),
  );
  const maxDown = Math.max(1, ...pageDowns.map((d) => d ?? 0));
  const index = desc.indexOf(selected);
  const monthItems = eventsForMonth(items, selected, timeZone);
  const count = (kind: HistoryItem["kind"]) =>
    items.filter((item) => item.kind === kind).length;
  const totalDown = pageDowns.reduce<number>((a, d) => a + (d ?? 0), 0);
  const estimate = mode === "requests" || mode === "runs";

  return (
    <>
      <MetricStrip>
        <MetricStripRow>
          <MetricStripItem>
            <MetricStripLabel>Uptime</MetricStripLabel>
            <MetricStripValue>
              {pct(uptime)}
              {/* narrow strips truncate the label instead; the sentence above says it too */}
              <MetricStripAside className="hidden @3xl:inline">
                <Badge
                  variant={isPreview ? "secondary" : "outline"}
                  className="align-middle"
                >
                  {isPreview ? "Preview" : "Public"}
                </Badge>
              </MetricStripAside>
            </MetricStripValue>
          </MetricStripItem>
          {[
            ["Downtime", formatDowntime(totalDown, estimate)],
            ["Events", String(count("event"))],
            ["Excused", String(count("excused"))],
            ["Windows", String(count("window"))],
            ["Components", String(rows.length)],
          ].map(([label, value]) => (
            <MetricStripItem key={label}>
              <MetricStripLabel>{label}</MetricStripLabel>
              <MetricStripValue>{value}</MetricStripValue>
            </MetricStripItem>
          ))}
        </MetricStripRow>
      </MetricStrip>

      <Activity>
        <ActivityHeader>
          <ActivityTitle>Downtime by month</ActivityTitle>
          <ActivityPeriod>Pick a month for its events</ActivityPeriod>
        </ActivityHeader>
        <MetricStrip>
          <MetricStripRow
            className={cn(
              desc.length > 12 && "@3xl:grid-flow-row @3xl:grid-cols-12",
            )}
          >
            {desc.map((key, i) => {
              const down = pageDowns[i];
              const year = key.slice(0, 4);
              // only where the strip crosses into an older year
              const showYear = i > 0 && desc[i - 1].slice(0, 4) !== year;
              const dots = eventsForMonth(items, key, timeZone).toSorted(
                (a, b) => a.from.getTime() - b.from.getTime(),
              );
              return (
                <MetricStripButton
                  key={key}
                  aria-pressed={key === selected}
                  aria-label={`${monthKeyToFullLabel(key)}: ${formatDowntime(down, estimate)} downtime, ${dots.length} events`}
                  onClick={() => setSelected(key)}
                  className="flex-wrap"
                >
                  <MetricStripLabel>
                    {format(monthDate(key), "MMM")}
                    {showYear ? (
                      <span className="ml-1 text-xs">{year}</span>
                    ) : null}
                  </MetricStripLabel>
                  <span
                    aria-hidden
                    className="hidden h-8 w-full items-end border-b @3xl:flex"
                  >
                    {down !== null ? (
                      <span
                        className={cn(
                          "w-full rounded-t-[2px]",
                          key === selected
                            ? "bg-foreground/70"
                            : "bg-foreground/15",
                        )}
                        style={{
                          height: `${Math.max(6, (down / maxDown) * 100)}%`,
                        }}
                      />
                    ) : null}
                  </span>
                  <MetricStripValue className="text-sm">
                    {formatDowntime(down, estimate)}
                  </MetricStripValue>
                  <span
                    aria-hidden
                    className="order-last flex h-1.5 basis-full flex-wrap gap-0.5 overflow-hidden @3xl:basis-auto"
                  >
                    {dots.map((item) => (
                      <span
                        key={historyItemKey(item)}
                        className={cn(
                          "size-1.5 rounded-full",
                          historyItemDot[historyItemKind(item)],
                        )}
                      />
                    ))}
                  </span>
                </MetricStripButton>
              );
            })}
          </MetricStripRow>
        </MetricStrip>
      </Activity>

      <Activity>
        <ActivityHeader>
          <ActivityTitle>Activity</ActivityTitle>
        </ActivityHeader>
        <StatusCalendar
          markers={markers}
          month={monthDate(selected)}
          onMonthChange={(m) => {
            const key = format(m, "yyyy-MM");
            if (months.includes(key)) setSelected(key);
          }}
          disableFuture
          title="All components"
        />
        <HistoryItemLegend />
      </Activity>

      <EventGroup>
        <EventGroupHeader>
          <EventGroupTitle>
            {monthKeyToFullLabel(selected)}
            <EventGroupCount>{monthItems.length}</EventGroupCount>
          </EventGroupTitle>
          <EventGroupHint>
            {pct(pageMonthUptime(rows, selected))} ·{" "}
            {formatDowntime(pageDowns[index], estimate)} down
            {index === 0 ? " · in progress" : ""}
          </EventGroupHint>
        </EventGroupHeader>
        <EventList>
          {monthItems.map((item) => (
            <HistoryItemRow
              key={historyItemKey(item)}
              item={item}
              mode={mode}
              timeZone={timeZone}
            />
          ))}
        </EventList>
        <EventGroupEmpty>
          <EmptyStateMedia>
            <Calendar />
          </EmptyStateMedia>
          <EmptyStateTitle>Quiet month</EmptyStateTitle>
          <EmptyStateDescription>
            No outages, status reports, maintenances or windows.
          </EmptyStateDescription>
        </EventGroupEmpty>
      </EventGroup>

      <EventGroup>
        <EventGroupHeader>
          <EventGroupTitle>
            Components
            <EventGroupCount>{rows.length}</EventGroupCount>
          </EventGroupTitle>
          <EventGroupHint>
            Downtime per month, last {months.length} months
          </EventGroupHint>
        </EventGroupHeader>
        <EventList>
          {rows.map((row) => {
            const value = row.months[selected]?.percentage ?? null;
            const counts = row.months[selected];
            const downs = desc.map((key) =>
              downtimeMinutes(row.months[key]?.percentage, key, timeZone),
            );
            return (
              <EventRow key={row.component.id} className="flex gap-x-2">
                <ComponentListName>{row.component.name}</ComponentListName>
                <span className="ml-auto flex shrink-0 items-center gap-3">
                  {counts && row.unit !== "time" ? (
                    <span className="text-muted-foreground hidden font-mono text-xs tabular-nums @3xl:inline">
                      {formatNumber(counts.error)} of{" "}
                      {formatNumber(counts.ok + counts.degraded + counts.error)}{" "}
                      {row.unit} failed
                    </span>
                  ) : null}
                  <DowntimeBars
                    values={downs}
                    selected={index}
                    className="h-4"
                    style={{ width: desc.length * 6 }}
                  />
                  <span
                    className={cn(
                      "w-16 text-right font-mono text-xs tabular-nums",
                      value === null && "text-muted-foreground/50",
                    )}
                  >
                    {value === null
                      ? "no data"
                      : formatDowntime(downs[index], row.unit !== "time")}
                  </span>
                  <span className="text-muted-foreground hidden w-16 text-right font-mono text-xs tabular-nums sm:inline">
                    {pct(value)}
                  </span>
                </span>
              </EventRow>
            );
          })}
        </EventList>
        <EventGroupEmpty>
          <EmptyStateMedia>
            <Calendar />
          </EmptyStateMedia>
          <EmptyStateTitle>No components</EmptyStateTitle>
          <EmptyStateDescription>
            Add components to the page to track their uptime.
          </EmptyStateDescription>
        </EventGroupEmpty>
      </EventGroup>
    </>
  );
}
