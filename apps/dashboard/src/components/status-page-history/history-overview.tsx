"use client";

import { Calendar } from "@openstatus/icons";
import {
  StatusCalendar,
  type StatusCalendarMarker,
} from "@openstatus/ui/components/blocks/status-calendar";
import { Badge } from "@openstatus/ui/components/ui/badge";
import { cn } from "@openstatus/ui/lib/utils";
import { eachDayOfInterval, format, startOfDay } from "date-fns";
import { useMemo, useState } from "react";

import {
  Activity,
  ActivityHeader,
  ActivityPeriod,
  ActivityTitle,
} from "@/components/content/activity";
import {
  ComponentList,
  ComponentListItem,
  ComponentListName,
} from "@/components/content/component-list";
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
import { EventList } from "@/components/content/event-list";
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
import { formatDurationShort, truncatePercentage } from "@/lib/formatter";

import {
  HistoryItemLegend,
  HistoryItemRow,
  historyItemDot,
} from "./history-item-row";

const pct = (v: number | null | undefined) =>
  v === null || v === undefined ? "–" : `${truncatePercentage(v)}%`;

const formatDowntime = (minutes: number | null) =>
  minutes === null ? "–" : formatDurationShort(minutes * 60_000);

function monthDate(key: string): Date {
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month - 1, 1);
}

/** Neutral bars: we don't know the customer's target, so height is the only signal. */
function DowntimeBars({
  values,
  selected,
  className,
}: {
  values: (number | null)[];
  selected: number;
  className?: string;
}) {
  const max = Math.max(1, ...values.map((v) => v ?? 0));
  return (
    <span aria-hidden className={cn("flex items-end gap-px", className)}>
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

// the block tints by status only, so excused outages (neutral) stay out of it
function toMarkers(items: HistoryItem[]): StatusCalendarMarker[] {
  return items.flatMap((item) => {
    if (item.kind === "excused") return [];
    const days = eachDayOfInterval({
      start: startOfDay(item.from),
      end: startOfDay(item.to ?? new Date()),
    });
    const where = item.components.join(", ");
    return days.map((date) =>
      item.kind === "window"
        ? {
            id: `${historyItemKey(item)}-${date.getTime()}`,
            date,
            status: "info" as const,
            type: "maintenance" as const,
            name: `Window · ${item.window.title} · ${where}`,
            from: item.from,
            to: item.to,
          }
        : {
            id: `${historyItemKey(item)}-${date.getTime()}`,
            date,
            status: item.event.status,
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
  timeZone,
  utcOnlyMonths,
  uptime,
  mode,
  isPreview,
}: {
  rows: HistoryRow[];
  /** oldest first, the last one in progress */
  months: string[];
  timeZone: string;
  utcOnlyMonths: string[];
  uptime: number | null;
  mode: UptimeMode;
  isPreview: boolean;
}) {
  const [selected, setSelected] = useState(months[months.length - 1]);
  const items = useMemo(() => historyItems(rows), [rows]);
  const markers = useMemo(() => toMarkers(items), [items]);
  // a UTC-only month groups its days, and so its events, in UTC
  const zoneOf = (key: string) =>
    timeZone !== "UTC" && utcOnlyMonths.includes(key) ? "UTC" : timeZone;
  const pageDowns = months.map((key) =>
    downtimeMinutes(pageMonthUptime(rows, key), key, zoneOf(key)),
  );
  const maxDown = Math.max(1, ...pageDowns.map((d) => d ?? 0));
  const index = months.indexOf(selected);
  const monthItems = eventsForMonth(items, selected, zoneOf(selected));
  const count = (kind: HistoryItem["kind"]) =>
    items.filter((item) => item.kind === kind).length;
  const totalDown = pageDowns.reduce<number>((a, d) => a + (d ?? 0), 0);

  return (
    <div className="flex flex-col gap-6">
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
            ["Downtime", formatDowntime(totalDown)],
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
          <MetricStripRow>
            {months.map((key, i) => {
              const down = pageDowns[i];
              const dots = eventsForMonth(items, key, zoneOf(key)).toSorted(
                (a, b) => a.from.getTime() - b.from.getTime(),
              );
              return (
                <MetricStripButton
                  key={key}
                  aria-pressed={key === selected}
                  aria-label={`${monthKeyToFullLabel(key)}: ${formatDowntime(down)} downtime, ${dots.length} events`}
                  onClick={() => setSelected(key)}
                  className="flex-wrap"
                >
                  <MetricStripLabel>
                    {format(monthDate(key), "MMM")}
                    {zoneOf(key) !== timeZone ? (
                      <span className="ml-1 text-xs">UTC</span>
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
                    {formatDowntime(down)}
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
            {formatDowntime(pageDowns[index])} down
            {index === months.length - 1 ? " · in progress" : ""}
          </EventGroupHint>
        </EventGroupHeader>
        <EventList>
          {monthItems.map((item) => (
            <HistoryItemRow
              key={historyItemKey(item)}
              item={item}
              mode={mode}
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

      {/* not an EventGroup: that hides itself without event rows */}
      <section className="flex flex-col gap-2">
        <EventGroupHeader>
          <EventGroupTitle>
            Components
            <EventGroupCount>{rows.length}</EventGroupCount>
          </EventGroupTitle>
          <EventGroupHint>Downtime per month, last 12 months</EventGroupHint>
        </EventGroupHeader>
        <div className="bg-card rounded-lg border px-3 py-2">
          <ComponentList>
            {rows.map((row) => {
              const value = row.months[selected]?.percentage ?? null;
              const downs = months.map((key) =>
                downtimeMinutes(row.months[key]?.percentage, key, zoneOf(key)),
              );
              return (
                <ComponentListItem key={row.component.id}>
                  <ComponentListName>{row.component.name}</ComponentListName>
                  <span className="ml-auto flex shrink-0 items-center gap-3">
                    <DowntimeBars
                      values={downs}
                      selected={index}
                      className="h-4 w-[72px]"
                    />
                    <span
                      className={cn(
                        "w-16 text-right font-mono text-xs tabular-nums",
                        value === null && "text-muted-foreground/50",
                      )}
                    >
                      {value === null
                        ? "no data"
                        : formatDowntime(downs[index])}
                    </span>
                    <span className="text-muted-foreground hidden w-16 text-right font-mono text-xs tabular-nums sm:inline">
                      {pct(value)}
                    </span>
                  </span>
                </ComponentListItem>
              );
            })}
          </ComponentList>
        </div>
      </section>
    </div>
  );
}
