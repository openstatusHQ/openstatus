"use client";

import { StatusBar } from "@openstatus/ui/components/blocks/status-bar";
import type {
  StatusBarData,
  StatusType,
} from "@openstatus/ui/components/blocks/status.types";

type DailyRow = {
  day: string;
  worst_indicator: string;
  had_maintenance: number;
  snapshot_count: number;
};

function indicatorToStatusType(args: {
  worst_indicator: string;
  had_maintenance: number;
}): StatusType {
  if (args.had_maintenance) return "info";
  switch (args.worst_indicator) {
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
      worst_indicator:
        severityOf(r.worst_indicator) > severityOf(prev.worst_indicator)
          ? r.worst_indicator
          : prev.worst_indicator,
      had_maintenance:
        severityOf(r.worst_indicator) > severityOf(prev.worst_indicator)
          ? r.had_maintenance
          : prev.had_maintenance,
      snapshot_count: prev.snapshot_count + r.snapshot_count,
    });
  }
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
          worst_indicator: row.worst_indicator,
          had_maintenance: row.had_maintenance,
        })
      : "empty";
    out.push({
      day: iso,
      bar: [{ status, height: 100 }],
      card: [{ status, value: labelFor(status) }],
      events: [],
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
    <div className="[&_[data-slot=status-bar-item]>div>div]:rounded-none [&_[data-slot=status-bar-item]>div]:rounded-none [&_[data-slot=status-bar-item]]:rounded-none">
      <StatusBar data={data} />
    </div>
  );
}
