import { TZDate } from "@date-fns/tz";
import type { RouterOutputs } from "@openstatus/api";
import { format } from "date-fns";

import { formatDurationShort, formatNumber } from "@/lib/formatter";

// wire types inferred from the endpoint so server shape changes surface here
type HistoryWire = RouterOutputs["page"]["getUptimeHistory"];
type HistoryWireRow = HistoryWire["rows"][number];
export type HistoryUnit = HistoryWireRow["unit"] | "runs";
export type HistoryRow = Omit<HistoryWireRow, "unit" | "runs"> & {
  unit: HistoryUnit;
};
export type HistoryEvent = HistoryRow["events"][number];
export type HistoryMaintenanceWindow = HistoryRow["maintenanceWindows"][number];
export type HistoryExcusedOutage = HistoryRow["excusedOutages"][number];
export type HistoryValue = NonNullable<HistoryRow["months"][string]>;

export const HISTORY_METRICS = ["requests", "runs"] as const;
export type HistoryMetric = (typeof HISTORY_METRICS)[number];

/** The URL's metric, else runs on a runs page and requests otherwise. */
export function historyMetric(
  param: HistoryMetric | null,
  mode: HistoryWire["mode"],
): HistoryMetric {
  return param ?? (mode === "runs" ? "runs" : "requests");
}

/** Rows as `metric` counts them; rows without runs keep their own unit. */
export function historyRows(
  rows: HistoryWireRow[],
  metric: HistoryMetric,
): HistoryRow[] {
  return rows.map(({ runs, ...row }) =>
    metric === "runs" && runs ? { ...row, unit: "runs", ...runs } : row,
  );
}

export type BreakdownRow = {
  key: "ok" | "degraded" | "error";
  label: string;
  value: string;
};

/** Rows of a month's or window's card; time units have no degraded duration. */
export function historyBreakdown(
  value: HistoryValue,
  unit: HistoryUnit,
): { rows: BreakdownRow[]; total: { value: string; unit: string | null } } {
  if (unit === "time") {
    return {
      rows: [
        { key: "ok", label: "Success", value: formatDurationShort(value.ok) },
        {
          key: "error",
          label: "Error",
          value: formatDurationShort(value.error),
        },
      ],
      total: {
        value: formatDurationShort(value.ok + value.error),
        unit: null,
      },
    };
  }
  const total = value.ok + value.degraded + value.error;
  return {
    rows: [
      { key: "ok", label: "Success", value: formatNumber(value.ok) },
      {
        key: "degraded",
        label: "Degraded",
        value: formatNumber(value.degraded),
      },
      { key: "error", label: "Error", value: formatNumber(value.error) },
    ],
    total: {
      value: formatNumber(total),
      unit: total === 1 ? unit.slice(0, -1) : unit,
    },
  };
}

/**
 * Events overlapping the month in the page time zone, which is how the server
 * buckets months; open-ended events count up to now.
 */
export function eventsForMonth<T extends Pick<HistoryEvent, "from" | "to">>(
  events: T[],
  key: string,
  timeZone = "UTC",
): T[] {
  const [year, month] = key.split("-").map(Number);
  const start = new TZDate(year, month - 1, 1, timeZone).getTime();
  const end = new TZDate(year, month, 1, timeZone).getTime();
  const now = Date.now();
  return events.filter((e) => {
    const from = e.from.getTime();
    const to = e.to?.getTime() ?? now;
    return from < end && to >= start;
  });
}

function monthKeyToDate(key: string): Date {
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month - 1, 1);
}

export function monthKeyToLabel(key: string): string {
  return format(monthKeyToDate(key), "MMM yy");
}

/** Full month + year, e.g. "October 2025". */
export function monthKeyToFullLabel(key: string): string {
  return format(monthKeyToDate(key), "MMMM yyyy");
}
