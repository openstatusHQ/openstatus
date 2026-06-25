"use client";

import type { RouterOutputs } from "@openstatus/api";
import { dateFnsLocales } from "@openstatus/locales";
import { StatusBarEvent } from "@openstatus/ui/components/blocks/status-bar";
import {
  StatusCalendar as BlockStatusCalendar,
  StatusCalendarSkeleton as BlockStatusCalendarSkeleton,
  type StatusCalendarMarker,
  type StatusCalendarProps,
  type StatusCalendarSkeletonProps,
} from "@openstatus/ui/components/blocks/status-calendar";
import { useStatusBlocksLabels } from "@openstatus/ui/components/blocks/status-i18n";
import {
  eachDayOfInterval,
  max as maxDate,
  min as minDate,
  startOfDay,
} from "date-fns";
import { useLocale } from "next-intl";
import { useCallback, useMemo } from "react";

import { Link } from "@/components/common/link";
import { usePathnamePrefix } from "@/hooks/use-pathname-prefix";
import type { Locale as AppLocale } from "@/i18n/config";

type Page = NonNullable<RouterOutputs["statusPage"]["get"]>;
type ReportInput = Page["statusReports"][number];
type MaintenanceInput = Page["maintenances"][number];
type PageComponentInput = Page["pageComponents"][number];

type Props = Omit<StatusCalendarProps, "markers" | "renderMarkerRow"> & {
  statusReports?: ReportInput[];
  maintenances?: MaintenanceInput[];
  pageComponents?: PageComponentInput[];
  /**
   * Mirrors the bar's loading pattern (`status-bar.tsx` consumer): when true,
   * the wrapper renders `<StatusCalendarSkeleton>` instead of the calendar.
   * Wire this to the parent's data-fetch loading state.
   */
  isLoading?: boolean;
};

// Marker color is keyed by event TYPE (not status) so resolved historical
// outages still show as red/yellow rather than green. Mirrors StatusBarEvent.

export function StatusCalendar({
  statusReports = [],
  maintenances = [],
  pageComponents = [],
  isLoading,
  ...rest
}: Props) {
  const labels = useStatusBlocksLabels();
  const locale = useLocale() as AppLocale;
  const dateFnsLocale = dateFnsLocales[locale];
  const prefix = usePathnamePrefix();
  const base = prefix ? `/${prefix}` : "";
  const downtimeLabel = labels.systemStatus.error.short;
  const calendarTitle = labels.calendarTitle;

  const markers = useMemo<StatusCalendarMarker[]>(() => {
    const out: StatusCalendarMarker[] = [];

    for (const report of statusReports) {
      const updates = report.statusReportUpdates
        .slice()
        .sort((a, b) => a.date.getTime() - b.date.getTime());
      const firstUpdate = updates[0];
      const lastUpdate = updates[updates.length - 1];
      const startedAt = firstUpdate?.date ?? report.createdAt;
      if (!startedAt) continue;
      // Null (ongoing) unless a resolved update gives a real end date.
      const resolvedAt =
        report.status === "resolved" && lastUpdate?.status === "resolved"
          ? lastUpdate.date
          : null;

      out.push({
        id: `report-${report.id}`,
        date: startOfDay(startedAt),
        status: "degraded",
        type: "report",
        name: report.title,
        from: startedAt,
        to: resolvedAt,
        href: `${base}/events/report/${report.id}`,
      });
    }

    for (const m of maintenances) {
      const start = startOfDay(minDate([m.from, m.to]));
      const end = startOfDay(maxDate([m.from, m.to]));
      const href = `${base}/events/maintenance/${m.id}`;
      for (const day of eachDayOfInterval({ start, end })) {
        out.push({
          id: `maintenance-${m.id}-${day.toISOString()}`,
          date: day,
          status: "info",
          type: "maintenance",
          name: m.title,
          from: m.from,
          to: m.to,
          href,
        });
      }
    }

    const seenIncidents = new Set<number>();
    for (const c of pageComponents) {
      const incidents = c.monitor?.incidents ?? [];
      for (const inc of incidents) {
        if (seenIncidents.has(inc.id)) continue;
        seenIncidents.add(inc.id);
        const startedAt = inc.startedAt;
        const end = startOfDay(inc.resolvedAt ?? new Date());
        const start = startOfDay(startedAt);
        for (const day of eachDayOfInterval({ start, end })) {
          out.push({
            id: `incident-${inc.id}-${day.toISOString()}`,
            date: day,
            status: "error",
            type: "incident",
            // `incident.title` is empty string on the DB row by default; use
            // the localized "Downtime" label as a sensible fallback.
            name: inc.title?.trim() ? inc.title : downtimeLabel,
            from: startedAt,
            to: inc.resolvedAt,
          });
        }
      }
    }

    return out;
  }, [statusReports, maintenances, pageComponents, downtimeLabel, base]);

  const renderMarkerRow = useCallback((marker: StatusCalendarMarker) => {
    const event = (
      <StatusBarEvent
        type={marker.type}
        name={marker.name}
        from={marker.from}
        to={marker.to}
        isAggregated={marker.isAggregated}
      />
    );
    if (marker.href) {
      return (
        <Link
          variant="unstyled"
          href={marker.href}
          className="hover:bg-accent/50 block cursor-pointer rounded-sm"
        >
          {event}
        </Link>
      );
    }
    return event;
  }, []);

  if (isLoading) {
    return <BlockStatusCalendarSkeleton title={calendarTitle} />;
  }

  return (
    <BlockStatusCalendar
      title={calendarTitle}
      locale={dateFnsLocale}
      markers={markers}
      renderMarkerRow={renderMarkerRow}
      eventTypes={["report", "maintenance"]}
      disableFuture
      {...rest}
    />
  );
}

/**
 * App-side skeleton wrapper that injects the localized "Calendar" title.
 * Use while the status-page data is in flight.
 */
export function StatusCalendarSkeleton(
  props: Omit<StatusCalendarSkeletonProps, "title">,
) {
  const labels = useStatusBlocksLabels();
  return (
    <BlockStatusCalendarSkeleton title={labels.calendarTitle} {...props} />
  );
}
