"use client";

import {
  StatusCalendar,
  type StatusCalendarMarker,
} from "@openstatus/ui/components/blocks/status-calendar";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@openstatus/ui/components/ui/hover-card";
import { cn } from "@openstatus/ui/lib/utils";
import {
  eachDayOfInterval,
  endOfMonth,
  format,
  formatDistanceStrict,
  getDay,
  isAfter,
  isSameDay,
  startOfDay,
} from "date-fns";
import { useMemo, useState } from "react";

import { truncatePercentage } from "@/lib/formatter";

import {
  type PageEvent,
  type Row,
  type Severity,
  type UptimeHistory,
  eventFill,
  eventsInMonth,
  monthDate,
  pageEvents,
  pageMonth,
  severityFill,
  severityOf,
  severityText,
  severityTint,
} from "./data";

const pct = (v: number | null | undefined) =>
  v === null || v === undefined ? "–" : `${truncatePercentage(v)}%`;

function EventLine({ event }: { event: PageEvent }) {
  return (
    <div className="flex items-start gap-2 text-xs">
      <span
        className={cn("mt-1 size-2 shrink-0 rounded-xs", eventFill[event.type])}
      />
      <div className="grid min-w-0 gap-0.5">
        <span className="text-foreground truncate">{event.name}</span>
        <span className="text-muted-foreground truncate">
          {format(event.from, "MMM d, HH:mm")} ·{" "}
          {event.to ? formatDistanceStrict(event.from, event.to) : "ongoing"} ·{" "}
          {event.components.join(", ")}
        </span>
      </div>
    </div>
  );
}

function Legend() {
  return (
    <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
      {(
        [
          ["incident", "Outage"],
          ["report", "Status report"],
          ["maintenance", "Maintenance"],
        ] as const
      ).map(([type, label]) => (
        <span key={type} className="flex items-center gap-1.5">
          <span className={cn("size-2 rounded-xs", eventFill[type])} />
          {label}
        </span>
      ))}
    </div>
  );
}

function ComponentMonthList({ rows, month }: { rows: Row[]; month: string }) {
  return (
    <div className="divide-y">
      {rows.map((row) => {
        const v = row.months[month]?.percentage ?? null;
        const sev = severityOf(v);
        return (
          <div
            key={row.component.id}
            className="flex items-center gap-3 py-2 text-sm"
          >
            <span className={cn("size-2 rounded-full", severityFill[sev])} />
            <span className="flex-1 truncate">{row.component.name}</span>
            <span
              className={cn(
                "font-mono text-xs",
                v === null ? "text-muted-foreground/50" : "text-foreground",
              )}
            >
              {pct(v)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ---------- A. Year strip: one combined row, drill into a month ----------

export function VariantStrip({ history }: { history: UptimeHistory }) {
  const { months, rows } = history;
  const [selected, setSelected] = useState(months[months.length - 1]);
  const events = useMemo(() => pageEvents(rows), [rows]);
  const monthEvents = eventsInMonth(events, selected);

  return (
    <div className="bg-card overflow-hidden rounded-lg border">
      <div className="grid grid-cols-6 gap-px border-b sm:grid-cols-12">
        {months.map((key, i) => {
          const v = pageMonth(rows, key);
          const sev = severityOf(v);
          const evs = eventsInMonth(events, key);
          const isSelected = key === selected;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setSelected(key)}
              className={cn(
                "hover:bg-muted/50 flex flex-col items-stretch gap-1.5 p-2 text-left transition-colors",
                isSelected && "bg-muted",
              )}
            >
              <span
                className={cn(
                  "text-muted-foreground text-xs",
                  i === months.length - 1 && "text-info",
                )}
              >
                {format(monthDate(key), "MMM")}
              </span>
              <span className={cn("h-10 rounded-sm", severityFill[sev])} />
              <span className="font-mono text-xs">{pct(v)}</span>
              <span className="flex h-2 gap-0.5">
                {evs.slice(0, 4).map((e) => (
                  <span
                    key={`${e.type}-${e.id}`}
                    className={cn("size-1.5 rounded-full", eventFill[e.type])}
                  />
                ))}
              </span>
            </button>
          );
        })}
      </div>
      <div className="grid gap-6 p-4 md:grid-cols-2">
        <div>
          <div className="mb-1 flex items-baseline justify-between">
            <span className="text-sm font-medium">
              {format(monthDate(selected), "MMMM yyyy")}
            </span>
            <span className="font-mono text-sm">
              {pct(pageMonth(rows, selected))}
            </span>
          </div>
          <ComponentMonthList rows={rows} month={selected} />
        </div>
        <div className="grid content-start gap-3">
          <span className="text-sm font-medium">
            Events{" "}
            <span className="text-muted-foreground font-normal">
              {monthEvents.length}
            </span>
          </span>
          {monthEvents.length === 0 ? (
            <span className="text-muted-foreground text-xs">
              Nothing happened this month.
            </span>
          ) : (
            monthEvents.map((e) => (
              <EventLine key={`${e.type}-${e.id}`} event={e} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- B. Calendar: the status-page calendar block, all components ----------

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

export function VariantCalendar({ history }: { history: UptimeHistory }) {
  const { months, rows } = history;
  const [month, setMonth] = useState(() =>
    monthDate(months[months.length - 1]),
  );
  const events = useMemo(() => pageEvents(rows), [rows]);
  const markers = useMemo(() => toMarkers(events), [events]);
  const key = format(month, "yyyy-MM");
  const v = pageMonth(rows, key);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_16rem]">
      <StatusCalendar
        markers={markers}
        month={month}
        onMonthChange={setMonth}
        disableFuture
        title={
          <span className="flex items-baseline gap-2">
            All components
            <span
              className={cn(
                "font-mono text-xs",
                severityTint[severityOf(v)],
                "rounded px-1.5 py-0.5",
              )}
            >
              {pct(v)}
            </span>
          </span>
        }
      />
      <div className="bg-card grid content-start gap-3 rounded-lg border p-4">
        <span className="text-sm font-medium">
          {format(month, "MMMM yyyy")}
        </span>
        <ComponentMonthList rows={rows} month={key} />
        <Legend />
      </div>
    </div>
  );
}

// ---------- C. Year at a glance: 12 mini calendars ----------

const RANK: Record<Severity, number> = {
  error: 3,
  degraded: 2,
  success: 1,
  empty: 0,
};

function daySeverity(events: PageEvent[], day: Date): Severity | "info" {
  let worst: Severity | "info" = "success";
  for (const e of events) {
    const from = startOfDay(e.from);
    const to = startOfDay(e.to ?? new Date());
    if (day < from || day > to) continue;
    if (e.type === "maintenance") {
      if (worst === "success") worst = "info";
      continue;
    }
    const sev: Severity = e.type === "incident" ? "error" : "degraded";
    if (worst === "info" || RANK[sev] > RANK[worst]) worst = sev;
  }
  return worst;
}

const dayFill: Record<Severity | "info", string> = {
  success: "bg-success/25",
  degraded: "bg-warning",
  error: "bg-destructive",
  info: "bg-info",
  empty: "bg-muted",
};

export function VariantYear({ history }: { history: UptimeHistory }) {
  const { months, rows, createdAt } = history;
  const events = useMemo(() => pageEvents(rows), [rows]);
  const today = startOfDay(new Date());

  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
        {months.map((key) => {
          const start = monthDate(key);
          const days = eachDayOfInterval({
            start,
            end: endOfMonth(start),
          });
          const offset = (getDay(start) + 6) % 7;
          const v = pageMonth(rows, key);
          const monthEvents = eventsInMonth(events, key);
          return (
            <div key={key} className="bg-card rounded-lg border p-3">
              <div className="mb-2 flex items-baseline justify-between">
                <span className="text-sm font-medium">
                  {format(start, "MMM yyyy")}
                </span>
                <span
                  className={cn(
                    "font-mono text-xs",
                    severityText[severityOf(v)],
                  )}
                >
                  {pct(v)}
                </span>
              </div>
              <div className="grid grid-cols-7 gap-0.5">
                {Array.from({ length: offset }).map((_, i) => (
                  <span key={`pad-${i}`} />
                ))}
                {days.map((day) => {
                  const beforeData =
                    createdAt !== null && day < startOfDay(createdAt);
                  const future = isAfter(day, today);
                  const sev =
                    future || beforeData || v === null
                      ? "empty"
                      : daySeverity(monthEvents, day);
                  return (
                    <span
                      key={day.toISOString()}
                      title={format(day, "MMM d")}
                      className={cn(
                        "aspect-square rounded-[2px]",
                        dayFill[sev],
                        isSameDay(day, today) &&
                          "ring-foreground/40 ring-1 ring-offset-1",
                      )}
                    />
                  );
                })}
              </div>
              <div className="text-muted-foreground mt-2 h-4 truncate text-xs">
                {monthEvents.length > 0
                  ? `${monthEvents.length} event${monthEvents.length > 1 ? "s" : ""}`
                  : ""}
              </div>
            </div>
          );
        })}
      </div>
      <Legend />
    </div>
  );
}

// ---------- D. Heatmap: the table, as color, with a combined row on top ----------

function HeatCell({
  value,
  label,
  events,
  strong,
}: {
  value: number | null;
  label: string;
  events: PageEvent[];
  strong?: boolean;
}) {
  const sev = severityOf(value);
  return (
    <HoverCard openDelay={50} closeDelay={50}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          className="group flex cursor-default flex-col items-stretch gap-1"
        >
          <span
            className={cn(
              "rounded-sm transition-opacity group-hover:opacity-80",
              strong ? "h-8" : "h-5",
              sev === "empty"
                ? "bg-muted/60 border border-dashed"
                : severityFill[sev],
            )}
          />
          <span className="flex h-1.5 justify-center gap-0.5">
            {events.slice(0, 3).map((e) => (
              <span
                key={`${e.type}-${e.id}`}
                className={cn("size-1.5 rounded-full", eventFill[e.type])}
              />
            ))}
          </span>
        </button>
      </HoverCardTrigger>
      <HoverCardContent className="grid w-64 gap-2 p-3 text-xs">
        <div className="flex justify-between font-medium">
          <span>{label}</span>
          <span className="font-mono">{pct(value)}</span>
        </div>
        {events.map((e) => (
          <EventLine key={`${e.type}-${e.id}`} event={e} />
        ))}
      </HoverCardContent>
    </HoverCard>
  );
}

export function VariantHeatmap({ history }: { history: UptimeHistory }) {
  const { months, rows } = history;
  const events = useMemo(() => pageEvents(rows), [rows]);

  return (
    <div className="bg-card overflow-x-auto rounded-lg border p-4">
      <div
        className="grid min-w-[640px] items-center gap-x-1.5 gap-y-2"
        style={{
          gridTemplateColumns: `10rem repeat(${months.length}, minmax(0, 1fr)) 4.5rem`,
        }}
      >
        <span />
        {months.map((key, i) => (
          <span
            key={key}
            className={cn(
              "text-muted-foreground text-center text-xs",
              i === months.length - 1 && "text-info",
            )}
          >
            {format(monthDate(key), "MMM")}
          </span>
        ))}
        <span className="text-muted-foreground text-right text-xs">12 mo</span>

        <span className="text-sm font-medium">All components</span>
        {months.map((key) => (
          <HeatCell
            key={key}
            strong
            value={pageMonth(rows, key)}
            label={format(monthDate(key), "MMMM yyyy")}
            events={eventsInMonth(events, key)}
          />
        ))}
        <span className="text-right font-mono text-sm font-medium">
          {pct(history.summary.uptime)}
        </span>

        <span className="col-span-full my-1 border-t" />

        {rows.map((row) => {
          const own = pageEvents([row]);
          return (
            <div key={row.component.id} className="contents">
              <span className="text-muted-foreground truncate text-sm">
                {row.component.name}
              </span>
              {months.map((key) => (
                <HeatCell
                  key={key}
                  value={row.months[key]?.percentage ?? null}
                  label={`${row.component.name} · ${format(monthDate(key), "MMMM yyyy")}`}
                  events={eventsInMonth(own, key)}
                />
              ))}
              <span className="text-muted-foreground text-right font-mono text-xs">
                {pct(row.total?.percentage)}
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-4">
        <Legend />
      </div>
    </div>
  );
}

// ---------- E. Ledger: months as a report, newest first ----------

export function VariantLedger({ history }: { history: UptimeHistory }) {
  const { months, rows } = history;
  const events = useMemo(() => pageEvents(rows), [rows]);

  return (
    <div className="bg-card divide-y rounded-lg border">
      {[...months].reverse().map((key, i) => {
        const v = pageMonth(rows, key);
        const monthEvents = eventsInMonth(events, key);
        const withData = rows.filter((r) => r.months[key]);
        return (
          <div
            key={key}
            className="grid gap-3 p-4 md:grid-cols-[9rem_minmax(0,1fr)_minmax(0,1.2fr)]"
          >
            <div className="grid content-start gap-0.5">
              <span className="text-sm font-medium">
                {format(monthDate(key), "MMMM yyyy")}
              </span>
              <span
                className={cn(
                  "font-mono text-lg",
                  v === null && "text-muted-foreground/50",
                )}
              >
                {pct(v)}
              </span>
              {i === 0 ? (
                <span className="text-info text-xs">In progress</span>
              ) : null}
            </div>
            <div className="grid content-start gap-1.5">
              <div className="flex h-2 gap-0.5 overflow-hidden rounded-full">
                {rows.map((r) => (
                  <span
                    key={r.component.id}
                    className={cn(
                      "flex-1",
                      severityFill[severityOf(r.months[key]?.percentage)],
                    )}
                  />
                ))}
              </div>
              <span className="text-muted-foreground text-xs">
                {withData.length} of {rows.length} components ·{" "}
                {
                  withData.filter(
                    (r) => severityOf(r.months[key]?.percentage) === "success",
                  ).length
                }{" "}
                at ≥ 99.9%
              </span>
            </div>
            <div className="grid content-start gap-2">
              {monthEvents.length === 0 ? (
                <span className="text-muted-foreground text-xs">
                  No incidents, reports or maintenances.
                </span>
              ) : (
                monthEvents.map((e) => (
                  <EventLine key={`${e.type}-${e.id}`} event={e} />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------- A + B: strip picks the month, the calendar block details it ----------

function MonthStrip({
  history,
  events,
  selected,
  onSelect,
}: {
  history: UptimeHistory;
  events: PageEvent[];
  selected: string;
  onSelect: (key: string) => void;
}) {
  const { months, rows } = history;
  return (
    <div className="grid grid-cols-6 border-y sm:grid-cols-12">
      {months.map((key, i) => {
        const v = pageMonth(rows, key);
        return (
          <button
            key={key}
            type="button"
            aria-pressed={key === selected}
            onClick={() => onSelect(key)}
            className={cn(
              "hover:bg-muted/50 flex flex-col items-stretch gap-1.5 p-2 text-left transition-colors",
              key === selected && "bg-muted",
            )}
          >
            <span
              className={cn(
                "text-muted-foreground text-xs",
                i === months.length - 1 && "text-info",
              )}
            >
              {format(monthDate(key), "MMM")}
            </span>
            <span
              className={cn("h-10 rounded-sm", severityFill[severityOf(v)])}
            />
            <span className="font-mono text-xs">{pct(v)}</span>
            <span className="flex h-1.5 gap-0.5">
              {eventsInMonth(events, key)
                .slice(0, 4)
                .map((e) => (
                  <span
                    key={`${e.type}-${e.id}`}
                    className={cn("size-1.5 rounded-full", eventFill[e.type])}
                  />
                ))}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function VariantCombined({ history }: { history: UptimeHistory }) {
  const { months, rows, summary } = history;
  const [selected, setSelected] = useState(months[months.length - 1]);
  const events = useMemo(() => pageEvents(rows), [rows]);
  const markers = useMemo(() => toMarkers(events), [events]);
  const index = months.indexOf(selected);
  const v = pageMonth(rows, selected);
  const previous = index > 0 ? pageMonth(rows, months[index - 1]) : null;
  const delta = v !== null && previous !== null ? v - previous : null;
  const monthEvents = eventsInMonth(events, selected);

  return (
    <div className="bg-card overflow-hidden rounded-lg border">
      <div className="flex flex-wrap items-end gap-x-8 gap-y-3 px-4 py-3">
        {[
          ["Page uptime · 12 months", pct(summary.uptime)],
          ["Events", String(events.length)],
          ["Components", String(rows.length)],
        ].map(([label, value]) => (
          <div key={label} className="grid gap-0.5">
            <span className="text-muted-foreground text-xs">{label}</span>
            <span className="font-mono text-lg font-medium">{value}</span>
          </div>
        ))}
        <div className="ml-auto">
          <Legend />
        </div>
      </div>
      <MonthStrip
        history={history}
        events={events}
        selected={selected}
        onSelect={setSelected}
      />
      <div className="grid md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <StatusCalendar
          markers={markers}
          month={monthDate(selected)}
          onMonthChange={(m) => {
            const key = format(m, "yyyy-MM");
            if (months.includes(key)) setSelected(key);
          }}
          disableFuture
          className="rounded-none border-0 md:border-r"
          title={
            <span className="flex items-baseline gap-2">
              All components
              <span
                className={cn(
                  "rounded px-1.5 py-0.5 font-mono text-xs",
                  severityTint[severityOf(v)],
                )}
              >
                {pct(v)}
              </span>
              {delta !== null ? (
                <span
                  className={cn(
                    "font-mono text-xs",
                    delta >= 0 ? "text-success" : "text-destructive",
                  )}
                >
                  {delta >= 0 ? "+" : "−"}
                  {Math.abs(delta).toFixed(3)} pp
                </span>
              ) : null}
            </span>
          }
        />
        <div className="grid content-start gap-5 border-t p-4 md:border-t-0">
          <div className="grid gap-1">
            <span className="text-sm font-medium">Components</span>
            <ComponentMonthList rows={rows} month={selected} />
          </div>
          <div className="grid gap-3">
            <span className="text-sm font-medium">
              Events{" "}
              <span className="text-muted-foreground font-normal">
                {monthEvents.length}
              </span>
            </span>
            {monthEvents.length === 0 ? (
              <span className="text-muted-foreground text-xs">
                Nothing happened this month.
              </span>
            ) : (
              monthEvents.map((e) => (
                <EventLine key={`${e.type}-${e.id}`} event={e} />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
