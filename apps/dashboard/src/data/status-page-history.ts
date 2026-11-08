import type { RouterOutputs } from "@openstatus/api";
import { format } from "date-fns";

import { formatDurationShort, formatNumber } from "@/lib/formatter";

// single client-side source for the window set; the server keeps its own
// WINDOWS tuple (services can't be imported into client bundles)
export const HISTORY_WINDOWS = [6, 12, 24] as const;
export type HistoryWindow = (typeof HISTORY_WINDOWS)[number];

// safe because callers only pass values rendered from HISTORY_WINDOWS tabs;
// anything else falls back to the default window
export function parseWindow(value: string): HistoryWindow {
  const window = Number(value);
  return (HISTORY_WINDOWS as readonly number[]).includes(window)
    ? (window as HistoryWindow)
    : HISTORY_WINDOWS[0];
}

export type UptimeStatus =
  | "operational"
  | "degraded"
  | "down"
  | "in-progress"
  | "no-data";

export type MonthCell = {
  percentage: number | null;
  status: UptimeStatus;
};

// wire types inferred from the endpoint so server shape changes surface here
type HistoryWireRow = RouterOutputs["page"]["getUptimeHistory"]["rows"][number];
export type HistoryUnit = HistoryWireRow["unit"] | "runs";
export type HistoryRow = Omit<HistoryWireRow, "unit" | "runs"> & {
  unit: HistoryUnit;
};
export type HistoryEvent = HistoryRow["events"][number];
export type HistoryValue = NonNullable<HistoryRow["months"][string]>;

export const HISTORY_METRICS = ["requests", "runs"] as const;
export type HistoryMetric = (typeof HISTORY_METRICS)[number];

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

/** "Last 6 months", the header of the window total's card. */
export function windowLabel(window: HistoryWindow): string {
  return `Last ${window} months`;
}

// safe because HistoryRow.rolling keys are exactly the string forms of HistoryWindow
export function windowKey(window: HistoryWindow): keyof HistoryRow["rolling"] {
  return String(window) as keyof HistoryRow["rolling"];
}

/**
 * Events overlapping the month; open-ended events count up to now.
 * UTC boundaries — the server buckets months in UTC, so local boundaries
 * would list an event under a neighboring month for non-UTC users.
 */
export function eventsForMonth(
  events: HistoryEvent[],
  key: string,
): HistoryEvent[] {
  const [year, month] = key.split("-").map(Number);
  const start = Date.UTC(year, month - 1, 1);
  const end = Date.UTC(year, month, 1);
  const now = Date.now();
  return events.filter((e) => {
    const from = e.from.getTime();
    const to = e.to?.getTime() ?? now;
    return from < end && to >= start;
  });
}

// presentational thresholds only — the verb owns the uptime math
export function cellFromPercentage(
  percentage: number | null,
  isCurrent = false,
): MonthCell {
  if (percentage === null) return { percentage, status: "no-data" };
  if (isCurrent) return { percentage, status: "in-progress" };
  return {
    percentage,
    status:
      percentage >= 99.9
        ? "operational"
        : percentage >= 99
          ? "degraded"
          : "down",
  };
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

/** Show slots 1…window; hide the rest of the served months. */
export function getColumnVisibility(
  window: HistoryWindow,
  monthCount: number,
): Record<string, boolean> {
  if (window >= monthCount) return {};
  return Object.fromEntries(
    Array.from({ length: monthCount - window }, (_, i) => [
      String(i + window + 1),
      false,
    ]),
  );
}
