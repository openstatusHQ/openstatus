import type { RouterOutputs } from "@openstatus/api";

import { truncatePercentage } from "@/lib/formatter";

export const REPORT_PERIODS = [
  "this-month",
  "last-month",
  "3m",
  "6m",
  "12m",
  "custom",
] as const;
export type ReportPeriod = (typeof REPORT_PERIODS)[number];

export const REPORT_PERIOD_LABELS = {
  "this-month": "This month",
  "last-month": "Last month",
  "3m": "Last 3 months",
  "6m": "Last 6 months",
  "12m": "Last 12 months",
  custom: "Custom",
} satisfies Record<ReportPeriod, string>;

const COMPLETE_MONTHS: Partial<Record<ReportPeriod, number>> = {
  "last-month": 1,
  "3m": 3,
  "6m": 6,
  "12m": 12,
};

// Date.UTC normalises overflowing months and days
const utcStart = (year: number, month: number, day = 1) =>
  new Date(Date.UTC(year, month, day));

/**
 * `[from, to)` of a report period in UTC. Month-aligned presets keep the
 * server prefetch and the client on the same input within a month.
 */
export function reportRange(
  input: { period: ReportPeriod; from?: string | null; to?: string | null },
  now: Date,
): { from: Date; to: Date } {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const { period } = input;

  if (period === "custom" && input.from && input.to) {
    const [fy, fm, fd] = input.from.split("-").map(Number);
    const [ty, tm, td] = input.to.split("-").map(Number);
    const from = utcStart(fy, fm - 1, fd);
    const to = utcStart(ty, tm - 1, td + 1);
    if (!Number.isNaN(from.getTime()) && from < to) return { from, to };
  }
  const count = COMPLETE_MONTHS[period];
  if (count !== undefined) {
    return {
      from: utcStart(year, month - count),
      to: utcStart(year, month),
    };
  }
  return {
    from: utcStart(year, month),
    to: utcStart(year, month + 1),
  };
}

type Report = RouterOutputs["monitorIncident"]["report"];
export type ReportMonth = Report["months"][number];

/** Truncated to thousandths of a percent; em dash for no data. */
export function formatAvailability(pct: number | null): string {
  return pct === null ? "—" : `${truncatePercentage(pct)}%`;
}

const EXAMPLE_DOWNTIME_MS = [0, 240_000, 0, 0, 1_380_000, 0];

/** Placeholder months behind the upgrade overlay, ending at the current UTC month. */
export function exampleReportMonths(now = new Date()): ReportMonth[] {
  const year = now.getUTCFullYear();
  const first = now.getUTCMonth() - EXAMPLE_DOWNTIME_MS.length + 1;
  return EXAMPLE_DOWNTIME_MS.map((downtimeMs, i) => {
    const start = utcStart(year, first + i);
    const spanMs = utcStart(year, first + i + 1).getTime() - start.getTime();
    return {
      month: start.toISOString().slice(0, 10),
      availability: ((spanMs - downtimeMs) / spanMs) * 100,
      downtimeMs,
      outages: downtimeMs > 0 ? 1 : 0,
    };
  });
}

export function resolutionLabel(incident: {
  resolvedAt: Date | null;
  autoResolved: boolean | null;
  resolvedByUser: { name: string } | null;
}): string {
  if (!incident.resolvedAt) return "ongoing";
  if (incident.autoResolved) return "auto-resolved";
  const by = incident.resolvedByUser?.name;
  // rows written through the v1 API carry no resolver
  return by ? `resolved manually by ${by}` : "resolved manually";
}
