"use client";

import { Calendar } from "@openstatus/icons";
import { StatusBarEvent } from "@openstatus/ui/components/blocks/status-bar";
import { StatusCalendar } from "@openstatus/ui/components/blocks/status-calendar";
import { Tabs, TabsList, TabsTrigger } from "@openstatus/ui/components/ui/tabs";
import { cn } from "@openstatus/ui/lib/utils";
import { format } from "date-fns";
import { useMemo } from "react";

import {
  Activity,
  ActivityHeader,
  ActivityPeriod,
  ActivityTitle,
} from "@/components/content/activity";
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
import { EventList, EventListMore } from "@/components/content/event-list";
import {
  MetricStrip,
  MetricStripAside,
  MetricStripButton,
  MetricStripLabel,
  MetricStripRow,
  MetricStripValue,
} from "@/components/metric/metric-strip";
import { MonitorIncidentRow } from "@/components/monitor-incidents/monitor-incident-row";
import { dayKey } from "@/data/activity.client";
import {
  type CheckSource,
  type HistoryDay,
  type HistoryMonth,
  type HistorySource,
  type MonitorHistoryIncident,
  checkMarkers,
  checkSuccess,
  checksTotal,
  failedShare,
  historyDays,
  historySourceLabel,
  isCheckMarker,
  outageDurations,
  outageMarkers,
} from "@/data/monitor-history.client";
import { formatAvailability } from "@/data/monitor-report.client";
import {
  monthKeyToDate,
  monthKeyToFullLabel,
} from "@/data/status-page-history";
import type { CheckCounts } from "@/data/uptime-history.client";
import { usePaged } from "@/hooks/use-paged";
import { formatDurationShort, formatNumber } from "@/lib/formatter";

const formatDowntime = (ms: number) => (ms > 0 ? formatDurationShort(ms) : "—");

function checksLine(c: CheckCounts | null, source: CheckSource) {
  const total = c ? checksTotal(c) : 0;
  if (!c || total === 0) return `No ${source}`;
  return `${formatAvailability(checkSuccess(c))} · ${formatNumber(c.error)} of ${formatNumber(total)} failed`;
}

function outageLine(outage: HistoryDay["outage"]) {
  if (!outage) return "None";
  const parts = [];
  if (outage.count > 0) {
    parts.push(
      `${formatDurationShort(outage.downtimeMs)} down`,
      `${outage.count} ${outage.count === 1 ? "outage" : "outages"}`,
    );
  }
  if (outage.excused > 0) parts.push(`${outage.excused} excused`);
  return parts.join(" · ");
}

function DayCard({
  day,
  source,
  showRuns,
}: {
  day: HistoryDay;
  source: HistorySource;
  showRuns: boolean;
}) {
  const rows: [HistorySource, string][] = [
    ["outages", outageLine(day.outage)],
    ["requests", checksLine(day.requests, "requests")],
  ];
  if (showRuns) rows.push(["runs", checksLine(day.runs, "runs")]);
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
      {rows.map(([key, value]) => (
        <div
          key={key}
          className={cn(
            "col-span-2 grid grid-cols-subgrid",
            key !== source && "text-muted-foreground",
          )}
        >
          <dt className={cn(key === source && "font-medium")}>
            {historySourceLabel[key]}
          </dt>
          <dd className="text-right font-mono tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

// keyed by month so paging restarts when the month changes
function MonthOutageList({
  incidents,
}: {
  incidents: MonitorHistoryIncident[];
}) {
  const paged = usePaged(incidents);
  return (
    <EventList>
      {paged.visible.map((incident) => (
        <MonitorIncidentRow key={incident.id} incident={incident} />
      ))}
      {paged.hasMore ? (
        <EventListMore onClick={paged.showMore}>Show older</EventListMore>
      ) : null}
    </EventList>
  );
}

export function MonitorHistoryOverview({
  title,
  months,
  incidents,
  requests,
  runs,
  showRuns,
  source,
  onSourceChange,
  month,
  onMonthChange,
  now,
}: {
  title: string;
  /** newest first, the first one in progress */
  months: HistoryMonth[];
  incidents: MonitorHistoryIncident[];
  requests: CheckCounts[];
  runs: CheckCounts[];
  showRuns: boolean;
  source: HistorySource;
  onSourceChange: (source: HistorySource) => void;
  /** YYYY-MM; null or outside `months`, the latest */
  month: string | null;
  onMonthChange: (month: string | null) => void;
  /** keeps an ongoing outage growing and today current */
  now: Date;
}) {
  const selected = months.find((m) => m.key === month) ?? months[0];
  const index = months.indexOf(selected);
  // the month in progress drops out of the URL
  const setSelected = (key: string) =>
    onMonthChange(key === months[0]?.key ? null : key);

  const counts = source === "runs" ? runs : requests;
  const markers = useMemo(
    () =>
      source === "outages"
        ? outageMarkers(incidents, now)
        : checkMarkers(counts, source),
    [source, incidents, counts, now],
  );
  const dayOf = useMemo(
    () => historyDays(incidents, requests, runs, now),
    [incidents, requests, runs, now],
  );

  const maxDown = Math.max(1, ...months.map((m) => m.downtimeMs));
  const maxFailed = Math.max(
    Number.EPSILON,
    ...months.map((m) => (source === "outages" ? 0 : failedShare(m[source]))),
  );
  // the active check source, or requests on the outages tab
  const emptySource: CheckSource = source === "runs" ? "runs" : "requests";
  const emptyChecks = selected?.[emptySource];
  const today = now.toISOString().slice(0, 10);
  const oldest = months.at(-1);
  const periodStart = oldest ? `${oldest.key}-01` : today;
  const durations =
    source === "outages" && selected
      ? outageDurations(selected.incidents)
      : null;
  const hint = [
    durations
      ? `Longest ${formatDurationShort(durations.longestMs)} · MTTR ${formatDurationShort(durations.meanMs)}`
      : null,
    index === 0 ? "In progress" : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <Activity>
        <ActivityHeader>
          <ActivityTitle>
            {source === "outages"
              ? "Downtime by month"
              : `Failed ${source} by month`}
          </ActivityTitle>
          <Tabs
            value={source}
            onValueChange={(v) => onSourceChange(v as HistorySource)}
          >
            <TabsList>
              <TabsTrigger value="outages">Outages</TabsTrigger>
              <TabsTrigger value="requests">Requests</TabsTrigger>
              {showRuns ? <TabsTrigger value="runs">Runs</TabsTrigger> : null}
            </TabsList>
          </Tabs>
        </ActivityHeader>
        <MetricStrip>
          <MetricStripRow
            className={cn(
              months.length > 12 && "@3xl:grid-flow-row @3xl:grid-cols-12",
            )}
          >
            {months.map((m, i) => {
              const year = m.key.slice(0, 4);
              // only where the strip crosses into an older year
              const showYear = i > 0 && months[i - 1].key.slice(0, 4) !== year;
              const c = source === "outages" ? null : m[source];
              const ratio =
                source === "outages"
                  ? m.downtimeMs / maxDown
                  : failedShare(c) / maxFailed;
              const value =
                source === "outages"
                  ? formatDowntime(m.downtimeMs)
                  : formatAvailability(checkSuccess(c));
              return (
                <MetricStripButton
                  key={m.key}
                  aria-pressed={m === selected}
                  aria-label={`${monthKeyToFullLabel(m.key)}: ${value}`}
                  onClick={() => setSelected(m.key)}
                  className="flex-wrap"
                >
                  <MetricStripLabel>
                    {format(monthKeyToDate(m.key), "MMM")}
                    {showYear ? (
                      <span className="ml-1 text-xs">{year}</span>
                    ) : null}
                  </MetricStripLabel>
                  <span
                    aria-hidden
                    className="hidden h-8 w-full items-end border-b @3xl:flex"
                  >
                    {ratio > 0 ? (
                      <span
                        className={cn(
                          "w-full rounded-t-xs",
                          m === selected
                            ? "bg-foreground/70"
                            : "bg-foreground/15",
                        )}
                        style={{ height: `${Math.max(6, ratio * 100)}%` }}
                      />
                    ) : null}
                  </span>
                  <MetricStripValue className="text-sm">
                    {value}
                    {c && c.error > 0 ? (
                      <MetricStripAside className="hidden @3xl:inline">
                        {formatNumber(c.error)}
                      </MetricStripAside>
                    ) : null}
                  </MetricStripValue>
                  {source === "outages" ? (
                    <span
                      aria-hidden
                      className="order-last flex h-1.5 basis-full flex-wrap gap-0.5 overflow-hidden @3xl:basis-auto"
                    >
                      {m.incidents.map((incident) => (
                        <span
                          key={incident.id}
                          className={cn(
                            "size-1.5 rounded-lg",
                            incident.excusedAt
                              ? "bg-muted-foreground/50"
                              : "bg-destructive",
                          )}
                        />
                      ))}
                    </span>
                  ) : null}
                </MetricStripButton>
              );
            })}
          </MetricStripRow>
        </MetricStrip>
      </Activity>

      {selected ? (
        <>
          <Activity>
            <ActivityHeader>
              <ActivityTitle>Activity</ActivityTitle>
              {source !== "outages" ? (
                <ActivityPeriod>
                  Amber: some failed · Red: over 5% failed
                </ActivityPeriod>
              ) : null}
            </ActivityHeader>
            <StatusCalendar
              markers={markers}
              month={monthKeyToDate(selected.key)}
              onMonthChange={(m) => {
                const key = format(m, "yyyy-MM");
                if (months.some((x) => x.key === key)) setSelected(key);
              }}
              disableFuture
              title={`${title} · ${historySourceLabel[source]}`}
              // check markers only tint the day; the day card carries their numbers
              renderMarkerRow={(marker) =>
                isCheckMarker(marker) ? null : (
                  <StatusBarEvent
                    type={marker.type}
                    name={marker.name}
                    from={marker.from}
                    to={marker.to}
                    status={marker.status}
                  />
                )
              }
              renderDayCard={(date) => {
                const key = dayKey(date);
                if (key > today || key < periodStart) return null;
                return (
                  <DayCard
                    day={dayOf(key)}
                    source={source}
                    showRuns={showRuns}
                  />
                );
              }}
            />
          </Activity>

          <EventGroup>
            <EventGroupHeader>
              <EventGroupTitle>
                {monthKeyToFullLabel(selected.key)}
                <EventGroupCount>{selected.incidents.length}</EventGroupCount>
              </EventGroupTitle>
              {hint ? <EventGroupHint>{hint}</EventGroupHint> : null}
            </EventGroupHeader>
            <MonthOutageList
              key={selected.key}
              incidents={selected.incidents}
            />
            <EventGroupEmpty>
              <EmptyStateMedia>
                <Calendar />
              </EmptyStateMedia>
              <EmptyStateTitle>No outages this month</EmptyStateTitle>
              <EmptyStateDescription>
                {emptyChecks?.error
                  ? `${formatNumber(emptyChecks.error)} ${emptySource} failed without opening an outage.`
                  : "Nothing recorded."}
              </EmptyStateDescription>
            </EventGroupEmpty>
          </EventGroup>
        </>
      ) : null}
    </>
  );
}
