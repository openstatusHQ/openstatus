"use client";

import type { PageComponentImpact } from "@openstatus/db/src/schema/page_components/constants";
import { Calendar } from "@openstatus/icons";
import {
  StatusCalendar,
  type StatusCalendarMarker,
} from "@openstatus/ui/components/blocks/status-calendar";
import { Badge } from "@openstatus/ui/components/ui/badge";
import { cn } from "@openstatus/ui/lib/utils";
import { eachDayOfInterval, format, startOfDay } from "date-fns";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";

import { StatusBars } from "@/components/common/status-bars";
import { StatusDot } from "@/components/common/status-dot";
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
import {
  EventList,
  EventRow,
  EventRowActions,
  EventRowContent,
  EventRowDate,
  EventRowDuration,
  EventRowMeta,
  EventRowStatus,
  EventRowTitle,
} from "@/components/content/event-list";
import {
  MetricStrip,
  MetricStripButton,
  MetricStripItem,
  MetricStripLabel,
  MetricStripRow,
  MetricStripValue,
} from "@/components/metric/metric-strip";
import { entityKinds } from "@/data/entity-refs.client";
import { downtimeActivity } from "@/data/incidents.client";
import { impactDisplay } from "@/data/status-report-updates.client";
import { impactLevels } from "@/data/status-reports.client";
import {
  formatDurationShort,
  formatWindow,
  truncatePercentage,
} from "@/lib/formatter";

import {
  type HistoryItem,
  type Row,
  type UptimeHistory,
  downtimeMinutes,
  eventsInMonth,
  formatDowntime,
  historyItems,
  itemKey,
  monthDate,
  pageMonth,
} from "./data";

const pct = (v: number | null | undefined) =>
  v === null || v === undefined ? "–" : `${truncatePercentage(v)}%`;

// prototype data has no impact rows; the real report carries its worst impact
function reportImpact(name: string): PageComponentImpact {
  return name.toLowerCase().includes("outage")
    ? "partial_outage"
    : "degraded_performance";
}

const durationOf = (item: HistoryItem) =>
  (item.to ?? new Date()).getTime() - item.from.getTime();

// ---------- one look per kind: row status, month dot, legend ----------

type Kind = "incident" | "report" | "maintenance" | "window" | "excused";

const kindOf = (item: HistoryItem): Kind =>
  item.kind === "event" ? item.event.type : item.kind;

// a hollow dot: the monitor-level window, apart from the page's solid maintenance
const RING = "border-info border-[1.5px] bg-transparent";

const dotClass: Record<Kind, string> = {
  incident: "bg-destructive",
  report: "bg-warning",
  maintenance: "bg-info",
  window: RING,
  excused: "bg-muted-foreground/50",
};

const LEGEND: { label: string; kinds: { kind: Kind; label: string }[] }[] = [
  {
    label: "Public",
    kinds: [
      { kind: "incident", label: "Outage" },
      { kind: "report", label: "Status report" },
      { kind: "maintenance", label: "Maintenance" },
    ],
  },
  {
    label: "Dashboard only",
    kinds: [
      { kind: "excused", label: "Excused outage" },
      { kind: "window", label: "Maintenance window" },
    ],
  },
];

function Legend() {
  return (
    <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
      {LEGEND.map((group, i) => (
        <span
          key={group.label}
          className="flex flex-wrap items-center gap-x-3 gap-y-1"
        >
          {i > 0 ? <span aria-hidden className="bg-border h-3 w-px" /> : null}
          <span className="font-mono text-[11px] uppercase">{group.label}</span>
          {group.kinds.map(({ kind, label }) => (
            <span key={kind} className="flex items-center gap-1.5">
              <span className={cn("size-2 rounded-full", dotClass[kind])} />
              {label}
            </span>
          ))}
        </span>
      ))}
    </div>
  );
}

/** Same indicator + label as the feature rows with `kind`. */
function ItemStatus({ item }: { item: HistoryItem }) {
  if (item.kind === "window") {
    return (
      <EventRowStatus>
        <StatusDot className={RING} />
        <span>Window</span>
      </EventRowStatus>
    );
  }
  const { level } = downtimeActivity(durationOf(item));
  if (item.kind === "excused") {
    // excused downtime drops the failure color, like MonitorIncidentRow
    return (
      <EventRowStatus>
        <StatusBars level={level} variant="default" />
        <span>Excused</span>
      </EventRowStatus>
    );
  }
  const { event } = item;
  if (event.type === "maintenance") {
    return (
      <EventRowStatus>
        <StatusDot variant="info" />
        <span>Maintenance</span>
      </EventRowStatus>
    );
  }
  if (event.type === "report") {
    const impact = reportImpact(event.name);
    return (
      <EventRowStatus>
        <StatusBars
          level={impactLevels[impact]}
          variant={impactDisplay(impact).variant}
        />
        <span>Report</span>
      </EventRowStatus>
    );
  }
  return (
    <EventRowStatus>
      <StatusBars
        level={level}
        variant={level === 3 ? "destructive" : "warning"}
      />
      <span>Outage</span>
    </EventRowStatus>
  );
}

function itemTitle(item: HistoryItem): string {
  if (item.kind === "event") return item.event.name;
  if (item.kind === "window") return item.title;
  // an excused outage has no title; the monitor is the entry, as on Outages
  return item.components[0] ?? "";
}

function itemHref(item: HistoryItem, pageId: string): string | undefined {
  if (item.kind === "window") return entityKinds.maintenanceWindow.href();
  if (item.kind === "excused") return undefined;
  if (item.event.type === "report")
    return `/status-pages/${pageId}/status-reports`;
  if (item.event.type === "maintenance")
    return `/status-pages/${pageId}/maintenances`;
  return undefined;
}

function HistoryItemRow({ item }: { item: HistoryItem }) {
  const { id: pageId } = useParams<{ id: string }>();
  const meta = [
    item.kind === "excused" ? null : item.components.join(", "),
    item.kind === "excused" ? (item.reason ?? "No reason") : null,
    // requests mode: its failed checks are still in the numbers
    item.kind === "excused" ? "still counts" : null,
    item.kind === "window"
      ? item.mode === "pause"
        ? "checks paused"
        : "alerts muted"
      : null,
    item.to ? formatWindow(item.from, item.to) : null,
  ].filter((m): m is string => m !== null);
  return (
    <EventRow>
      <EventRowDate date={item.from} />
      <ItemStatus item={item} />
      <EventRowContent>
        <EventRowTitle href={itemHref(item, pageId)}>
          {itemTitle(item)}
        </EventRowTitle>
        <EventRowMeta>
          {meta.map((m) => (
            <span key={m}>{m}</span>
          ))}
        </EventRowMeta>
      </EventRowContent>
      {item.kind !== "event" ? (
        <EventRowActions>
          <Badge
            variant="outline"
            className="text-muted-foreground font-mono text-[10px] uppercase"
            title="Not shown on the public status page"
          >
            Dashboard only
          </Badge>
        </EventRowActions>
      ) : null}
      <EventRowDuration>
        {formatDurationShort(durationOf(item))}
      </EventRowDuration>
    </EventRow>
  );
}

// ---------- month calendar: the public status page block ----------

// the block only tints by status, so excused outages (neutral) stay out of it
function toMarkers(items: HistoryItem[]): StatusCalendarMarker[] {
  return items.flatMap((item) => {
    if (item.kind === "excused") return [];
    const days = eachDayOfInterval({
      start: startOfDay(item.from),
      end: startOfDay(item.to ?? new Date()),
    });
    return days.map((date) =>
      item.kind === "window"
        ? {
            id: `${itemKey(item)}-${date.getTime()}`,
            date,
            status: "info" as const,
            type: "maintenance" as const,
            name: `Window · ${item.title} · ${item.components.join(", ")}`,
            from: item.from,
            to: item.to,
          }
        : {
            id: `${itemKey(item)}-${date.getTime()}`,
            date,
            status: item.event.status,
            type: item.event.type,
            name: `${item.event.name} · ${item.components.join(", ")}`,
            from: item.from,
            to: item.to,
          },
    );
  });
}

// ---------- months: downtime bars + one dot per item ----------

function MonthStrip({
  history,
  items,
  selected,
  onSelect,
}: {
  history: UptimeHistory;
  items: HistoryItem[];
  selected: string;
  onSelect: (key: string) => void;
}) {
  const { months, rows } = history;
  const downs = months.map((k) => downtimeMinutes(pageMonth(rows, k), k));
  const max = Math.max(1, ...downs.map((d) => d ?? 0));
  return (
    <MetricStrip>
      <MetricStripRow>
        {months.map((key, i) => {
          const d = downs[i];
          const monthItems = eventsInMonth(items, key).toSorted(
            (a, b) => a.from.getTime() - b.from.getTime(),
          );
          return (
            <MetricStripButton
              key={key}
              aria-pressed={key === selected}
              aria-label={`${format(monthDate(key), "MMMM yyyy")}: ${formatDowntime(d)} downtime, ${monthItems.length} events`}
              onClick={() => onSelect(key)}
              className="flex-wrap"
            >
              <MetricStripLabel>
                {format(monthDate(key), "MMM")}
              </MetricStripLabel>
              {/* neutral on purpose: we don't know the customer's target */}
              <span
                aria-hidden
                className="hidden h-8 w-full items-end border-b @3xl:flex"
              >
                {d !== null ? (
                  <span
                    className={cn(
                      "w-full rounded-t-[2px]",
                      key === selected
                        ? "bg-foreground/70"
                        : "bg-foreground/15",
                    )}
                    style={{ height: `${Math.max(6, (d / max) * 100)}%` }}
                  />
                ) : null}
              </span>
              <MetricStripValue className="text-sm">
                {formatDowntime(d)}
              </MetricStripValue>
              <span
                aria-hidden
                className="order-last flex h-1.5 basis-full flex-wrap gap-0.5 overflow-hidden @3xl:basis-auto"
              >
                {monthItems.map((item) => (
                  <span
                    key={itemKey(item)}
                    className={cn(
                      "size-1.5 rounded-full",
                      dotClass[kindOf(item)],
                    )}
                  />
                ))}
              </span>
            </MetricStripButton>
          );
        })}
      </MetricStripRow>
    </MetricStrip>
  );
}

function DowntimeSpark({
  values,
  selected,
}: {
  values: (number | null)[];
  selected: number;
}) {
  const max = Math.max(1, ...values.map((v) => v ?? 0));
  return (
    <span aria-hidden className="flex h-4 w-[72px] items-end gap-px">
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

function Components({
  rows,
  months,
  selected,
}: {
  rows: Row[];
  months: string[];
  selected: string;
}) {
  const index = months.indexOf(selected);
  return (
    <div className="bg-card rounded-lg border px-3 py-2">
      <ComponentList>
        {rows.map((row) => {
          const v = row.months[selected]?.percentage ?? null;
          const downs = months.map((k) =>
            downtimeMinutes(row.months[k]?.percentage, k),
          );
          return (
            <ComponentListItem key={row.component.id}>
              <ComponentListName>{row.component.name}</ComponentListName>
              <span className="ml-auto flex shrink-0 items-center gap-3">
                <DowntimeSpark values={downs} selected={index} />
                <span
                  className={cn(
                    "w-16 text-right font-mono text-xs tabular-nums",
                    v === null && "text-muted-foreground/50",
                  )}
                >
                  {v === null ? "no data" : formatDowntime(downs[index])}
                </span>
                <span className="text-muted-foreground hidden w-16 text-right font-mono text-xs tabular-nums sm:inline">
                  {pct(v)}
                </span>
              </span>
            </ComponentListItem>
          );
        })}
      </ComponentList>
    </div>
  );
}

export function HistoryOverview({ history }: { history: UptimeHistory }) {
  const { months, rows, summary } = history;
  const [selected, setSelected] = useState(months[months.length - 1]);
  const items = useMemo(() => historyItems(rows), [rows]);
  const markers = useMemo(() => toMarkers(items), [items]);
  const monthItems = eventsInMonth(items, selected);
  const v = pageMonth(rows, selected);
  const totalDown = months.reduce(
    (a, k) => a + (downtimeMinutes(pageMonth(rows, k), k) ?? 0),
    0,
  );
  const isCurrent = selected === months[months.length - 1];
  const count = (kind: HistoryItem["kind"]) =>
    items.filter((i) => i.kind === kind).length;

  return (
    <div className="flex flex-col gap-6">
      <MetricStrip>
        <MetricStripRow>
          {[
            ["Uptime", pct(summary.uptime)],
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
        <MonthStrip
          history={history}
          items={items}
          selected={selected}
          onSelect={setSelected}
        />
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
        <Legend />
      </Activity>

      <EventGroup>
        <EventGroupHeader>
          <EventGroupTitle>
            {format(monthDate(selected), "MMMM yyyy")}
            <EventGroupCount>{monthItems.length}</EventGroupCount>
          </EventGroupTitle>
          <EventGroupHint>
            {pct(v)} · {formatDowntime(downtimeMinutes(v, selected))} down
            {isCurrent ? " · in progress" : ""}
          </EventGroupHint>
        </EventGroupHeader>
        <EventList>
          {monthItems.map((item) => (
            <HistoryItemRow key={itemKey(item)} item={item} />
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
        <Components rows={rows} months={months} selected={selected} />
      </section>
    </div>
  );
}
