"use client";

import { Calendar, Info } from "@openstatus/icons";
import { cn } from "@openstatus/ui/lib/utils";
import { format, parseISO } from "date-fns";
import { useMemo } from "react";

import { Note } from "@/components/common/note";
import {
  Activity,
  ActivityHeader,
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
} from "@/components/content/activity-calendar";
import {
  EmptyStateContainer,
  EmptyStateDescription,
  EmptyStateMedia,
  EmptyStateTitle,
} from "@/components/content/empty-state";
import type { HistoryMetric } from "@/data/status-page-history";
import {
  type CheckCounts,
  checkHistorySince,
  formatUptime,
  utcToday,
  uptimeYears,
} from "@/data/uptime-history.client";

/**
 * Daily check success per year; inert example data when `limited`.
 * `reportFrom` is where availability starts, to flag check history that starts later.
 */
export function CheckSuccessHeatmap({
  counts,
  metric,
  partial,
  limited,
  reportFrom,
}: {
  counts: CheckCounts[];
  metric: HistoryMetric;
  partial?: boolean;
  limited?: boolean;
  reportFrom?: Date;
}) {
  const now = useMemo(() => new Date(), []);
  const today = useMemo(() => utcToday(now), [now]);
  const years = useMemo(
    () => uptimeYears(counts, now, metric),
    [counts, now, metric],
  );
  const since = checkHistorySince(counts);
  const startsLate =
    !limited &&
    !!since &&
    !!reportFrom &&
    since > reportFrom.toISOString().slice(0, 10);
  const hasBlank = years.some((y) => y.days.some((d) => d.blank));

  if (!limited && years.length === 0) {
    return (
      <EmptyStateContainer>
        <EmptyStateMedia>
          <Calendar />
        </EmptyStateMedia>
        <EmptyStateTitle>
          {metric === "runs" ? "No runs yet" : "No checks yet"}
        </EmptyStateTitle>
        <EmptyStateDescription>
          {metric === "runs"
            ? "Each day fills in once the monitor's scheduled checks have run across its cloud regions."
            : "Each day fills in once the monitor has run its first checks."}
        </EmptyStateDescription>
      </EmptyStateContainer>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {metric === "runs" && !limited ? (
        <Note size="sm">
          <Info />
          A run counts each scheduled check once across the monitor&apos;s cloud
          regions: it is down when at least half of the regions that reported
          fail.
        </Note>
      ) : null}
      {startsLate ? (
        <Note size="sm">
          <Info />
          Check history starts {format(parseISO(since), "MMM d, yyyy")}.
          Availability before that comes from outage records.
        </Note>
      ) : null}
      {partial && !limited ? (
        <Note color="warning" size="sm">
          <Info />
          Recent {metric} couldn&apos;t be loaded, so the last few weeks may be
          incomplete.
        </Note>
      ) : null}
      <div
        aria-hidden={limited}
        className={cn(
          "flex flex-col gap-6",
          limited && "pointer-events-none select-none",
        )}
      >
        {years.map(({ year, days, uptime, failedDays }) => (
          <Activity key={year}>
            <ActivityHeader>
              <ActivityTitle>{year}</ActivityTitle>
              <ActivityPeriod>
                {uptime === null
                  ? `No ${metric}`
                  : `${formatUptime(uptime, 3)} check success`}
                {failedDays > 0
                  ? ` · ${failedDays} ${failedDays === 1 ? "day" : "days"} with failures`
                  : null}
              </ActivityPeriod>
            </ActivityHeader>
            <ActivityCalendar>
              <ActivityCalendarGrid days={days} today={today} />
            </ActivityCalendar>
          </Activity>
        ))}
        <ActivityCalendar>
          <ActivityCalendarLegend>
            <ActivityCalendarLegendItem>
              <ActivityCalendarCell level={0} />
              No failures
            </ActivityCalendarLegendItem>
            <ActivityCalendarLegendItem>
              <ActivityCalendarCell level={1} />
              {"< 1% failed"}
            </ActivityCalendarLegendItem>
            <ActivityCalendarLegendItem>
              <ActivityCalendarCell level={2} />≤ 5%
            </ActivityCalendarLegendItem>
            <ActivityCalendarLegendItem>
              <ActivityCalendarCell level={3} />
              {"> 5%"}
            </ActivityCalendarLegendItem>
            <ActivityCalendarLegendSeparator />
            <ActivityCalendarLegendItem>
              <ActivityCalendarCell hatched />
              No {metric}
            </ActivityCalendarLegendItem>
            {hasBlank ? (
              <ActivityCalendarLegendItem>
                <ActivityCalendarCell blank />
                Before check history
              </ActivityCalendarLegendItem>
            ) : null}
            <ActivityCalendarLegendSeparator />
            <ActivityCalendarLegendItem>Days in UTC</ActivityCalendarLegendItem>
          </ActivityCalendarLegend>
        </ActivityCalendar>
      </div>
    </div>
  );
}
