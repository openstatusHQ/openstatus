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
  format,
  formatDistanceStrict,
  startOfDay,
} from "date-fns";
import { useMemo, useState } from "react";

import { truncatePercentage } from "@/lib/formatter";

import {
  type PageEvent,
  type Row,
  type UptimeHistory,
  downtimeMinutes,
  eventFill,
  eventsInMonth,
  formatDowntime,
  monthDate,
  pageEvents,
  pageMonth,
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

/** Neutral bars, height relative to the largest value; null is no data. */
function DowntimeSpark({
  values,
  selected,
}: {
  values: (number | null)[];
  selected: number;
}) {
  const max = Math.max(1, ...values.map((v) => v ?? 0));
  return (
    <span aria-hidden className="flex h-[18px] w-[72px] items-end gap-px">
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
              i === selected ? "bg-foreground/80" : "bg-foreground/15",
            )}
            style={{ height: `${Math.max(6, (v / max) * 100)}%` }}
          />
        ),
      )}
    </span>
  );
}

function ComponentList({
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
    <div className="divide-y">
      {rows.map((row) => {
        const v = row.months[selected]?.percentage ?? null;
        const downs = months.map((k) =>
          downtimeMinutes(row.months[k]?.percentage, k),
        );
        return (
          <div
            key={row.component.id}
            className="grid grid-cols-[minmax(0,1fr)_72px_64px] items-center gap-3 py-2 text-sm"
          >
            <span className="truncate">{row.component.name}</span>
            <DowntimeSpark values={downs} selected={index} />
            <span
              className={cn(
                "text-right font-mono text-xs",
                v === null && "text-muted-foreground/50",
              )}
            >
              {pct(v)}
              <span className="text-muted-foreground block text-[11px]">
                {v === null ? "no data" : formatDowntime(downs[index])}
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

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
  const downs = months.map((k) => downtimeMinutes(pageMonth(rows, k), k));
  const max = Math.max(1, ...downs.map((d) => d ?? 0));
  return (
    <div className="grid grid-cols-6 border-y sm:grid-cols-12">
      {months.map((key, i) => {
        const isSelected = key === selected;
        const monthEvents = eventsInMonth(events, key);
        const d = downs[i];
        return (
          <HoverCard key={key} openDelay={150} closeDelay={50}>
            <HoverCardTrigger asChild>
              <button
                type="button"
                aria-pressed={isSelected}
                onClick={() => onSelect(key)}
                className={cn(
                  "hover:bg-muted/50 flex min-w-0 flex-col items-stretch gap-1.5 p-2 text-left transition-colors",
                  isSelected && "bg-muted",
                )}
              >
                <span
                  className={cn(
                    "text-muted-foreground text-xs",
                    isSelected && "text-foreground font-medium",
                  )}
                >
                  {format(monthDate(key), "MMM")}
                </span>
                <span className="flex h-10 items-end border-b">
                  {d !== null ? (
                    <span
                      className={cn(
                        "w-full rounded-t-[3px] transition-colors",
                        isSelected ? "bg-foreground/80" : "bg-foreground/15",
                      )}
                      style={{ height: `${Math.max(4, (d / max) * 100)}%` }}
                    />
                  ) : null}
                </span>
                <span className="truncate font-mono text-xs">
                  {formatDowntime(d)}
                </span>
                <span className="text-muted-foreground hidden truncate font-mono text-[11px] sm:block">
                  {pct(pageMonth(rows, key))}
                </span>
                <span className="flex h-1.5 gap-0.5">
                  {monthEvents.slice(0, 4).map((e) => (
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
                <span>{format(monthDate(key), "MMMM yyyy")}</span>
                <span className="font-mono">{pct(pageMonth(rows, key))}</span>
              </div>
              <span className="text-muted-foreground">
                Downtime {formatDowntime(d)}
              </span>
              {monthEvents.map((e) => (
                <EventLine key={`${e.type}-${e.id}`} event={e} />
              ))}
            </HoverCardContent>
          </HoverCard>
        );
      })}
    </div>
  );
}

export function HistoryOverview({ history }: { history: UptimeHistory }) {
  const { months, rows, summary } = history;
  const [selected, setSelected] = useState(months[months.length - 1]);
  const events = useMemo(() => pageEvents(rows), [rows]);
  const markers = useMemo(() => toMarkers(events), [events]);
  const index = months.indexOf(selected);
  const v = pageMonth(rows, selected);
  const previous = index > 0 ? pageMonth(rows, months[index - 1]) : null;
  const delta = v !== null && previous !== null ? v - previous : null;
  const monthEvents = eventsInMonth(events, selected);
  const totalDown = months.reduce(
    (a, k) => a + (downtimeMinutes(pageMonth(rows, k), k) ?? 0),
    0,
  );

  return (
    <div className="bg-card overflow-hidden rounded-lg border">
      <div className="flex flex-wrap items-end gap-x-8 gap-y-3 px-4 py-3">
        {[
          ["Uptime · 12 months", pct(summary.uptime)],
          ["Downtime", formatDowntime(totalDown)],
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
      <div className="grid md:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
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
            <span className="flex flex-wrap items-baseline gap-2">
              All components
              <span className="bg-muted rounded px-1.5 py-0.5 font-mono text-xs">
                {pct(v)}
              </span>
              {delta !== null ? (
                <span className="text-muted-foreground font-mono text-xs">
                  {delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(3)} pp
                </span>
              ) : null}
            </span>
          }
        />
        <div className="grid content-start gap-5 border-t p-4 md:border-t-0">
          <div className="grid gap-1">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-medium">Components</span>
              <span className="text-muted-foreground text-xs">
                Downtime, 12 months
              </span>
            </div>
            <ComponentList rows={rows} months={months} selected={selected} />
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
