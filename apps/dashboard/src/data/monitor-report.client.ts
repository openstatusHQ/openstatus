import type { RouterOutputs } from "@openstatus/api";
import { format } from "date-fns";

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

const utcDay = (date: Date) =>
  Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);

// Date.UTC normalises overflowing months and days
const utcStart = (year: number, month: number, day = 1) =>
  new Date(Date.UTC(year, month, day));

/** UTC midnight of a `YYYY-MM-DD` day; undefined for anything that is not a real date. */
function utcDateOfDay(day: string | null | undefined): Date | undefined {
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return undefined;
  const date = new Date(`${day}T00:00:00.000Z`);
  // Date normalises 02-30 into March; a real day round-trips unchanged
  return utcDay(date) === day ? date : undefined;
}

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

  if (period === "custom") {
    const from = utcDateOfDay(input.from);
    const last = utcDateOfDay(input.to);
    if (from && last && from <= last) {
      return { from, to: new Date(last.getTime() + 86_400_000) };
    }
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

/** A picker's local calendar date as a `YYYY-MM-DD` day. */
export const dayOfLocalDate = (date: Date) => format(date, "yyyy-MM-dd");

/** The reverse: the day on the same local calendar date, for the picker. */
export function localDateOfDay(day: string | null): Date | undefined {
  const utc = utcDateOfDay(day);
  return utc && localDateOfUtc(utc);
}

/** Inclusive `from` / `to` days of a `[from, to)` UTC range, as a custom period stores them. */
export function rangeDays(range: { from: Date; to: Date }) {
  return {
    from: utcDay(range.from),
    to: utcDay(new Date(range.to.getTime() - 1)),
  };
}

// the picker works in local dates; put each UTC day on the same calendar day
const localDateOfUtc = (date: Date) =>
  new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());

/** The preset periods as date picker shortcuts. */
export function reportPresets(now: Date) {
  return REPORT_PERIODS.filter((p) => p !== "custom").map((p, i) => {
    const range = reportRange({ period: p }, now);
    return {
      label: REPORT_PERIOD_LABELS[p],
      shortcut: String(i + 1),
      from: localDateOfUtc(range.from),
      to: localDateOfUtc(new Date(range.to.getTime() - 1)),
    };
  });
}

/** Heartbeats and private-location-only monitors seldom open outages, so availability reads 100%. */
export function rarelyOpensOutages(monitor: {
  jobType: string;
  regions: readonly string[];
  privateLocations?: readonly unknown[] | null;
}): boolean {
  return (
    monitor.jobType === "heartbeat" ||
    (monitor.regions.length === 0 &&
      (monitor.privateLocations?.length ?? 0) > 0)
  );
}

/** The monitor report scrolled to its outages, on the UTC month `at` falls in. */
export function monitorReportHref(
  monitorId: number,
  at: Date,
  now = new Date(),
): string {
  const base = `/monitors/${monitorId}/report`;
  const start = utcStart(at.getUTCFullYear(), at.getUTCMonth());
  const next = utcStart(at.getUTCFullYear(), at.getUTCMonth() + 1);
  // the report opens on the current month by default
  if (now >= start && now < next) return `${base}#outages`;
  const { from, to } = rangeDays({ from: start, to: next });
  return `${base}?period=custom&from=${from}&to=${to}#outages`;
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
