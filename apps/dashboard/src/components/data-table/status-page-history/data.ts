import { format, subMonths } from "date-fns";

export const HISTORY_WINDOW_MONTHS = 24;

export type UptimeStatus = "operational" | "degraded" | "down" | "in-progress";

export type MonthCell = {
  percentage: number;
  status: UptimeStatus;
};

export type HistoryRow = {
  component: {
    id: number;
    name: string;
    kind: "Monitor" | "Static";
    basis: "requests" | "duration" | "manual";
    /** month key the component started reporting, e.g. "2026-02" */
    addedAt?: string;
    /** retained in history after the live component was deleted */
    deleted?: boolean;
  };
  /** keyed by month "YYYY-MM"; undefined = before the component existed */
  buckets: Record<string, MonthCell | undefined>;
  rolling6: number;
  rolling12: number;
  rolling24: number;
};

/** Relative slot (1 = current month) → "YYYY-MM" off the current month. */
export function offsetToKey(offset: number, now = new Date()): string {
  return format(subMonths(now, offset - 1), "yyyy-MM");
}

export function offsetToLabel(offset: number, now = new Date()): string {
  return format(subMonths(now, offset - 1), "MMM yy");
}

/** Full month + year, e.g. "October 2025". */
export function offsetToFullLabel(offset: number, now = new Date()): string {
  return format(subMonths(now, offset - 1), "MMMM yyyy");
}

/** Show slots 1…window; hide the rest. */
export function getColumnVisibility(
  window: 6 | 12 | 24,
): Record<string, boolean> {
  if (window === 24) return {};
  return Object.fromEntries(
    Array.from({ length: HISTORY_WINDOW_MONTHS - window }, (_, i) => [
      String(i + window + 1),
      false,
    ]),
  );
}
