import { TZDate } from "@date-fns/tz";

import { monthRange } from "./compute";

function monthKey(year: number, monthIndex: number): string {
  return new Date(Date.UTC(year, monthIndex, 1)).toISOString().slice(0, 10);
}

// runtimes disagree on which alias resolvedOptions() reports, so fold them here
const UTC_ALIASES = new Set([
  "utc",
  "etc/utc",
  "uct",
  "etc/uct",
  "gmt",
  "etc/gmt",
  "gmt0",
  "etc/gmt0",
  "gmt+0",
  "etc/gmt+0",
  "gmt-0",
  "etc/gmt-0",
  "greenwich",
  "etc/greenwich",
  "universal",
  "etc/universal",
  "zulu",
  "etc/zulu",
]);

/** The IANA name this runtime resolves `timeZone` to, UTC aliases as "UTC"; null when unknown or a raw offset. */
export function canonicalTimeZone(timeZone: string): string | null {
  const input = timeZone.trim();
  if (!input) return null;
  if (UTC_ALIASES.has(input.toLowerCase())) return "UTC";
  let resolved: string;
  try {
    resolved = new Intl.DateTimeFormat("en-US", {
      timeZone: input,
    }).resolvedOptions().timeZone;
  } catch {
    return null;
  }
  if (/^[+-]/.test(resolved) || /^[+-]/.test(input)) return null;
  return UTC_ALIASES.has(resolved.toLowerCase()) ? "UTC" : resolved;
}

/** YYYY-MM-01 of the month in `timeZone` holding the instant `at`. */
export function monthOf(at: number | Date, timeZone = "UTC"): string {
  const d = new TZDate(typeof at === "number" ? at : at.getTime(), timeZone);
  return monthKey(d.getFullYear(), d.getMonth());
}

/** `from` through `to` (YYYY-MM or YYYY-MM-01), oldest first, YYYY-MM-01. */
export function monthsBetween(from: string, to: string): string[] {
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  const count = (ty - fy) * 12 + (tm - fm) + 1;
  return Array.from({ length: Math.max(count, 0) }, (_, i) =>
    monthKey(fy, fm - 1 + i),
  );
}

/** [from, to) cut at UTC month boundaries, in order. */
export function splitByMonth(
  from: number,
  to: number,
): { month: string; start: number; end: number }[] {
  const parts: { month: string; start: number; end: number }[] = [];
  let start = from;
  while (start < to) {
    const month = monthOf(start);
    const end = Math.min(monthRange(month).end, to);
    parts.push({ month, start, end });
    start = end;
  }
  return parts;
}
