import type { RouterOutputs } from "@openstatus/api";

import { truncatePercentage } from "@/lib/formatter";

// Date.UTC normalises overflowing months
const utcStart = (year: number, month: number) =>
  new Date(Date.UTC(year, month, 1));

/** `YYYY-MM` of a real month, else null. */
export function parseMonthKey(key: string | null): string | null {
  if (!key || !/^\d{4}-(0[1-9]|1[0-2])$/.test(key)) return null;
  return key;
}

/**
 * `[from, to)` of the report in UTC: the current month and the 11 before it,
 * or a single month that a link to an older outage asks for.
 */
export function reportRange(
  now: Date,
  monthKey: string | null = null,
): { from: Date; to: Date } {
  const key = parseMonthKey(monthKey);
  if (key) {
    const [year, month] = key.split("-").map(Number);
    return { from: utcStart(year, month - 1), to: utcStart(year, month) };
  }
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  return { from: utcStart(year, month - 11), to: utcStart(year, month + 1) };
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

/** The monitor report scrolled to its outages, on the outage's month when older than the report. */
export function monitorReportHref(
  monitorId: number,
  at: Date,
  now = new Date(),
): string {
  const base = `/monitors/${monitorId}/report`;
  if (at >= reportRange(now).from) return `${base}#outages`;
  return `${base}?month=${at.toISOString().slice(0, 7)}#outages`;
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
