"use client";

import type { PageComponentImpact } from "@openstatus/db/src/schema/page_components/constants";
import { Calendar } from "@openstatus/icons";
import {
  StatusCalendar,
  type StatusCalendarMarker,
} from "@openstatus/ui/components/blocks/status-calendar";
import { Tabs, TabsList, TabsTrigger } from "@openstatus/ui/components/ui/tabs";
import { cn } from "@openstatus/ui/lib/utils";
import { addDays, eachDayOfInterval, format, startOfDay } from "date-fns";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";

import { StatusBars } from "@/components/common/status-bars";
import { StatusDot } from "@/components/common/status-dot";
import {
  Activity,
  ActivityHeader,
  type ActivityMark,
  ActivityPeriod,
  ActivityTitle,
} from "@/components/content/activity";
import {
  ActivityCalendar,
  ActivityCalendarCell,
  ActivityCalendarGrid,
  ActivityCalendarLegend,
  ActivityCalendarLegendItem,
  ActivityCalendarLegendSeparator,
  type ActivityDay,
  type ActivityLink,
} from "@/components/content/activity-calendar";
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
import { activityDayLines, spansOnDay } from "@/data/activity.client";
import { downtimeActivity } from "@/data/incidents.client";
import { maintenanceActivity } from "@/data/maintenances.client";
import { impactDisplay } from "@/data/status-report-updates.client";
import { impactLevels } from "@/data/status-reports.client";
import {
  formatDurationShort,
  formatWindow,
  truncatePercentage,
} from "@/lib/formatter";

import {
  type PageEvent,
  type Row,
  type UptimeHistory,
  downtimeMinutes,
  eventsInMonth,
  formatDowntime,
  monthDate,
  pageEvents,
  pageMonth,
} from "./data";

const pct = (v: number | null | undefined) =>
  v === null || v === undefined ? "–" : `${truncatePercentage(v)}%`;

// prototype data has no impact rows; the real report carries its worst impact
function reportImpact(event: PageEvent): PageComponentImpact {
  return event.name.toLowerCase().includes("outage")
    ? "partial_outage"
    : "degraded_performance";
}

const durationOf = (e: PageEvent) =>
  (e.to ?? new Date()).getTime() - e.from.getTime();

function eventHref(event: PageEvent, pageId: string): string | undefined {
  if (event.type === "report") return `/status-pages/${pageId}/status-reports`;
  if (event.type === "maintenance")
    return `/status-pages/${pageId}/maintenances`;
  return undefined;
}

/** Same indicator + label as StatusReportRow, MaintenanceRow and MonitorIncidentRow with `kind`. */
function HistoryEventStatus({ event }: { event: PageEvent }) {
  if (event.type === "maintenance") {
    return (
      <EventRowStatus>
        <StatusDot variant="info" />
        <span>Maintenance</span>
      </EventRowStatus>
    );
  }
  if (event.type === "report") {
    const impact = reportImpact(event);
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
  const { level } = downtimeActivity(durationOf(event));
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

function HistoryEventRow({ event }: { event: PageEvent }) {
  const { id: pageId } = useParams<{ id: string }>();
  return (
    <EventRow>
      <EventRowDate date={event.from} />
      <HistoryEventStatus event={event} />
      <EventRowContent>
        <EventRowTitle href={eventHref(event, pageId)}>
          {event.name}
        </EventRowTitle>
        <EventRowMeta>
          <span>{event.components.join(", ")}</span>
          {event.to ? <span>{formatWindow(event.from, event.to)}</span> : null}
        </EventRowMeta>
      </EventRowContent>
      <EventRowDuration>
        {formatDurationShort(durationOf(event))}
      </EventRowDuration>
    </EventRow>
  );
}

// ---------- year calendar: the dashboard's activity grid, Overview's day rules ----------

type Entry = ActivityMark & { lead: string };

const rank = (m: ActivityMark) =>
  m.hatched ? 0 : m.scale === "failure" ? 4 + m.level : m.level;

function activityDays(
  events: PageEvent[],
  from: Date,
  now: Date,
  pageId: string,
): ActivityDay[] {
  return eachDayOfInterval({ start: from, end: now }).map((date) => {
    const start = startOfDay(date);
    const end = addDays(start, 1);
    const items = events.filter((e) => e.from < end && (e.to ?? now) >= start);
    if (items.length === 0) return { date };
    const span = (e: PageEvent) => ({ start: e.from, end: e.to });
    const entries: Entry[] = [];
    for (const e of items.filter((i) => i.type === "report")) {
      const impact = reportImpact(e);
      entries.push({
        scale: "failure",
        level: impactLevels[impact],
        lead: `${impactDisplay(impact).label} · ${e.name}`,
      });
    }
    const outages = items.filter((i) => i.type === "incident");
    if (outages.length > 0) {
      const down = spansOnDay(date, outages.map(span), now);
      entries.push({
        ...downtimeActivity(down),
        lead: `${formatDurationShort(down)} down · ${outages[0].components.join(", ")}`,
      });
    }
    const maintenances = items.filter((i) => i.type === "maintenance");
    if (maintenances.length > 0) {
      const planned = spansOnDay(date, maintenances.map(span), now);
      entries.push({
        ...maintenanceActivity(planned),
        level: 2,
        lead: `${formatDurationShort(planned)} · ${maintenances[0].name}`,
      });
    }
    entries.sort((a, b) => rank(b) - rank(a));
    const [top, ...rest] = entries;
    const links: ActivityLink[] = items.flatMap((e) => {
      const href = eventHref(e, pageId);
      return href
        ? [
            {
              href,
              title: e.name,
              kind: e.type === "report" ? "Report" : "Maintenance",
            },
          ]
        : [];
    });
    return {
      date,
      scale: top.scale,
      level: top.level,
      hatched: top.hatched,
      lines: activityDayLines(
        top.lead,
        rest.map((r) => r.lead.split(" · ")[0]),
      ),
      links: links.length > 0 ? links : undefined,
    };
  });
}

function YearCalendar({ events, from }: { events: PageEvent[]; from: Date }) {
  const { id: pageId } = useParams<{ id: string }>();
  const days = useMemo(
    () => activityDays(events, from, new Date(), pageId),
    [events, from, pageId],
  );
  return (
    <ActivityCalendar>
      <ActivityCalendarGrid days={days} />
      <ActivityCalendarLegend>
        <ActivityCalendarLegendItem>
          <ActivityCalendarCell />
          None
        </ActivityCalendarLegendItem>
        <ActivityCalendarLegendItem>
          <ActivityCalendarCell level={1} />
          Low
        </ActivityCalendarLegendItem>
        <ActivityCalendarLegendItem>
          <ActivityCalendarCell level={2} />
          Mid
        </ActivityCalendarLegendItem>
        <ActivityCalendarLegendItem>
          <ActivityCalendarCell level={3} />
          High
        </ActivityCalendarLegendItem>
        <ActivityCalendarLegendSeparator />
        <ActivityCalendarLegendItem>
          <ActivityCalendarCell scale="planned" level={2} />
          Maintenance
        </ActivityCalendarLegendItem>
      </ActivityCalendarLegend>
    </ActivityCalendar>
  );
}

// ---------- month calendar: the public status page block ----------

function toMarkers(events: PageEvent[]): StatusCalendarMarker[] {
  return events.flatMap((e) =>
    eachDayOfInterval({
      start: startOfDay(e.from),
      end: startOfDay(e.to ?? new Date()),
    }).map((date) => ({
      id: `${e.type}-${e.id}-${date.getTime()}`,
      date,
      status: e.status,
      type: e.type,
      name: `${e.name} · ${e.components.join(", ")}`,
      from: e.from,
      to: e.to,
    })),
  );
}

// ---------- months: downtime bars on metric strip buttons ----------

function MonthStrip({
  history,
  selected,
  onSelect,
}: {
  history: UptimeHistory;
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
          return (
            <MetricStripButton
              key={key}
              aria-pressed={key === selected}
              aria-label={`${format(monthDate(key), "MMMM yyyy")}: ${formatDowntime(d)} downtime`}
              onClick={() => onSelect(key)}
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
  const [view, setView] = useState<"year" | "month">("year");
  const events = useMemo(() => pageEvents(rows), [rows]);
  const markers = useMemo(() => toMarkers(events), [events]);
  const from = useMemo(() => monthDate(months[0]), [months]);
  const monthEvents = eventsInMonth(events, selected);
  const v = pageMonth(rows, selected);
  const totalDown = months.reduce(
    (a, k) => a + (downtimeMinutes(pageMonth(rows, k), k) ?? 0),
    0,
  );
  const isCurrent = selected === months[months.length - 1];

  return (
    <div className="flex flex-col gap-6">
      <MetricStrip>
        <MetricStripRow>
          <MetricStripItem>
            <MetricStripLabel>Uptime</MetricStripLabel>
            <MetricStripValue>{pct(summary.uptime)}</MetricStripValue>
          </MetricStripItem>
          <MetricStripItem>
            <MetricStripLabel>Downtime</MetricStripLabel>
            <MetricStripValue>{formatDowntime(totalDown)}</MetricStripValue>
          </MetricStripItem>
          <MetricStripItem>
            <MetricStripLabel>Events</MetricStripLabel>
            <MetricStripValue>{events.length}</MetricStripValue>
          </MetricStripItem>
          <MetricStripItem>
            <MetricStripLabel>Components</MetricStripLabel>
            <MetricStripValue>{rows.length}</MetricStripValue>
          </MetricStripItem>
        </MetricStripRow>
      </MetricStrip>

      <Activity>
        <ActivityHeader>
          <ActivityTitle>Downtime by month</ActivityTitle>
          <ActivityPeriod>Pick a month for its events</ActivityPeriod>
        </ActivityHeader>
        <MonthStrip
          history={history}
          selected={selected}
          onSelect={setSelected}
        />
      </Activity>

      <Activity>
        <ActivityHeader>
          <ActivityTitle>Activity</ActivityTitle>
          <Tabs
            value={view}
            onValueChange={(next) =>
              setView(next === "month" ? "month" : "year")
            }
          >
            <TabsList>
              <TabsTrigger value="year">Year</TabsTrigger>
              <TabsTrigger value="month">Month</TabsTrigger>
            </TabsList>
          </Tabs>
        </ActivityHeader>
        {view === "year" ? (
          <YearCalendar events={events} from={from} />
        ) : (
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
        )}
      </Activity>

      <EventGroup>
        <EventGroupHeader>
          <EventGroupTitle>
            {format(monthDate(selected), "MMMM yyyy")}
            <EventGroupCount>{monthEvents.length}</EventGroupCount>
          </EventGroupTitle>
          <EventGroupHint>
            {pct(v)} · {formatDowntime(downtimeMinutes(v, selected))} down
            {isCurrent ? " · in progress" : ""}
          </EventGroupHint>
        </EventGroupHeader>
        <EventList>
          {monthEvents.map((e) => (
            <HistoryEventRow key={`${e.type}-${e.id}`} event={e} />
          ))}
        </EventList>
        <EventGroupEmpty>
          <EmptyStateMedia>
            <Calendar />
          </EmptyStateMedia>
          <EmptyStateTitle>Quiet month</EmptyStateTitle>
          <EmptyStateDescription>
            No outages, status reports or maintenances.
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
