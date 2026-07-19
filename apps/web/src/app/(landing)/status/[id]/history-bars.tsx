"use client";

import { StatusBar } from "@openstatus/ui/components/blocks/status-bar";
import type {
  StatusBarData,
  StatusType,
} from "@openstatus/ui/components/blocks/status.types";

import { renderIncidentEvent } from "../incident-event";
import {
  type OverlayIncident,
  bucketIncidentsByUtcDay,
} from "../incident-events";

type DailyRow = {
  day: string;
  worstIndicator: string;
  hadMaintenance: number;
  snapshotCount: number;
};

function indicatorToStatusType(args: {
  worstIndicator: string;
  hadMaintenance: number;
}): StatusType {
  if (args.hadMaintenance) return "info";
  switch (args.worstIndicator) {
    case "none":
      return "success";
    case "minor":
      return "degraded";
    case "major":
    case "critical":
      return "error";
    default:
      return "empty";
  }
}

function labelFor(status: StatusType): string {
  switch (status) {
    case "success":
      return "All Systems Operational";
    case "degraded":
      return "Degraded performance";
    case "error":
      return "Outage";
    case "info":
      return "Maintenance";
    default:
      return "No data";
  }
}

export type HistoryBarsProps = {
  daily: DailyRow[];
  days: number;
  incidents?: OverlayIncident[];
};

const INDICATOR_SEVERITY: Record<string, number> = {
  none: 0,
  minor: 1,
  major: 2,
  critical: 3,
};

function severityOf(indicator: string): number {
  return INDICATOR_SEVERITY[indicator] ?? -1;
}

function buildSeries(props: HistoryBarsProps): StatusBarData[] {
  // The history pipe groups by (day, id); when querying canonical + aliases
  // we get one row per slug per day. Merge them so the worst observed status
  // wins instead of letting iteration order pick the survivor.
  const byDay = new Map<string, DailyRow>();
  for (const r of props.daily) {
    const key = r.day.slice(0, 10);
    const prev = byDay.get(key);
    if (!prev) {
      byDay.set(key, r);
      continue;
    }
    byDay.set(key, {
      day: prev.day,
      worstIndicator:
        severityOf(r.worstIndicator) > severityOf(prev.worstIndicator)
          ? r.worstIndicator
          : prev.worstIndicator,
      hadMaintenance:
        severityOf(r.worstIndicator) > severityOf(prev.worstIndicator)
          ? r.hadMaintenance
          : prev.hadMaintenance,
      snapshotCount: prev.snapshotCount + r.snapshotCount,
    });
  }
  const eventsByDay = bucketIncidentsByUtcDay(props.incidents ?? [], {
    days: props.days,
  });
  const out: StatusBarData[] = [];
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  for (let i = props.days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setUTCDate(today.getUTCDate() - i);
    const iso = date.toISOString().slice(0, 10);
    const row = byDay.get(iso);
    const status: StatusType = row
      ? indicatorToStatusType({
          worstIndicator: row.worstIndicator,
          hadMaintenance: row.hadMaintenance,
        })
      : "empty";
    out.push({
      day: iso,
      bar: [{ status, height: 100 }],
      card: [{ status, value: labelFor(status) }],
      events: eventsByDay.get(iso) ?? [],
    });
  }
  return out;
}

export function HistoryBars(props: HistoryBarsProps) {
  const data = buildSeries(props);
  // Square the bars: the shared StatusBar block hard-codes rounded-full on the
  // item root, an overflow-hidden clip wrapper, and each segment. Override the
  // radius for this page only (descendant selectors outrank the block's
  // single-class utilities) without forking the shared component.
  return (
    <div className="[&_[data-slot=status-bar-item]]:rounded-none [&_[data-slot=status-bar-item]>div]:rounded-none [&_[data-slot=status-bar-item]>div>div]:rounded-none">
      <StatusBar data={data} renderEvent={renderIncidentEvent} />
    </div>
  );
}
