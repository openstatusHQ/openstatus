import type { MonitorSlaExcusedWindowKind } from "@openstatus/db/src/schema/monitor_sla_policies/constants";

const MONTH_SECONDS = 30 * 24 * 60 * 60;

/** `99500` → `"99.5"`; targets are stored in thousandths of a percent. */
export function formatSlaTarget(target: number): string {
  return String(target / 1000);
}

/** `"99.5"` → `99500`, or `null` unless it is above 0 and at most 100. */
export function parseSlaTarget(value: string): number | null {
  if (!/^\d{1,3}(\.\d{1,3})?$/.test(value.trim())) return null;
  const target = Math.round(Number(value) * 1000);
  return target > 0 && target <= 100_000 ? target : null;
}

export const SLA_PERCENT_MESSAGE =
  "Enter a percentage above 0, up to 100, with at most 3 decimals.";

/** A credit percentage above 0, up to 100, with at most three decimals, or `null`. */
export function parseSlaPercent(value: string): number | null {
  if (!/^\d{1,3}(\.\d{1,3})?$/.test(value.trim())) return null;
  const n = Number(value);
  return n > 0 && n <= 100 ? n : null;
}

/** A duration to the minute once it reaches an hour (to the second with `exact`), else to the second: `"3h 36m"`, `"43m 12s"`; the sign is dropped. */
export function formatSlaDuration(
  ms: number,
  options: { exact?: boolean } = {},
): string {
  const seconds = Math.floor(Math.abs(ms) / 1000);
  if (seconds === 0) return "0s";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const parts =
    h > 0
      ? [`${h}h`, `${m}m`, options.exact ? `${s}s` : null]
      : [`${m}m`, `${s}s`];
  return parts.filter((p) => p !== null && p !== "0m" && p !== "0s").join(" ");
}

/** Downtime a target allows in a 30-day month, to the second, e.g. `"6h 18m 52s"`. */
export function allowedDowntime(target: number): string {
  const seconds = Math.round((MONTH_SECONDS * (100_000 - target)) / 100_000);
  return formatSlaDuration(seconds * 1000, { exact: true });
}

/** `"12m left"`, or `"4m over"` once the budget is spent past zero. */
export function formatBudgetLeft(leftMs: number): string {
  return leftMs < 0
    ? `${formatSlaDuration(leftMs)} over`
    : `${formatSlaDuration(leftMs)} left`;
}

/** Share of the budget in `ms`, 0 to 1; any down time spends a zero budget whole. */
export function budgetShare(ms: number, budgetMs: number): number {
  if (budgetMs <= 0) return ms > 0 ? 1 : 0;
  return Math.min(Math.max(ms / budgetMs, 0), 1);
}

/** Coverage in thousandths of a percent → `"99.8"`, floored to one decimal. */
export function formatSlaCoverage(coverage: number): string {
  return (Math.floor(coverage / 100) / 10).toFixed(1);
}

/** `"2026-12-01"` → `"2027-01-01"`. */
export function nextSlaMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
}

/** The month `date` falls in, in `timeZone`, as `"2026-11-01"`. */
export function slaMonthOf(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${get("year")}-${get("month")}-01`;
}

/** `"2026-01-01"` → `"Jan"`, or `"Jan 2026"` with `year`. */
export function formatSlaMonth(
  month: string,
  options: { year?: boolean } = {},
): string {
  return new Date(`${month}T00:00:00Z`).toLocaleString("en-US", {
    month: "short",
    ...(options.year ? { year: "numeric" } : {}),
    timeZone: "UTC",
  });
}

/** `"→ 99.95% from Dec 2026"`: terms set to start in a later month. */
export function formatPendingTerms(pending: {
  target: number;
  effectiveFrom: string;
}): string {
  return `→ ${formatSlaTarget(pending.target)}% from ${formatSlaMonth(pending.effectiveFrom, { year: true })}`;
}

export const excusedKindLabels: Record<MonitorSlaExcusedWindowKind, string> = {
  maintenance: "Maintenance",
  emergency: "Emergency",
  third_party: "Third party",
  customer_caused: "Customer caused",
  force_majeure: "Force majeure",
  other: "Other",
};

function inZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value;
  return {
    day: `${get("month")} ${get("day")}`,
    time: `${get("hour")}:${get("minute")}`,
  };
}

/** `"Nov 4, 22:00 – 23:00"` in `timeZone` (UTC by default); both dates when it spans days. */
export function formatExcusedWindow(
  from: Date,
  to: Date,
  timeZone = "UTC",
): string {
  const a = inZone(from, timeZone);
  const b = inZone(to, timeZone);
  return a.day === b.day
    ? `${a.day}, ${a.time} – ${b.time}`
    : `${a.day}, ${a.time} – ${b.day}, ${b.time}`;
}

/** What the add dialog shows; nothing is refused on its account. */
export function excusedWindowContext(
  policy: {
    months: string[];
    monitors: {
      months: { month: string; met: boolean | null; state: string }[];
    }[];
    excusedWindows: { kind: MonitorSlaExcusedWindowKind; from: Date }[];
  },
  kind: MonitorSlaExcusedWindowKind,
) {
  const months = policy.months.slice(0, -1).slice(-2);
  const lastTwo = new Set(months);
  const missed = new Set(
    policy.monitors.flatMap((m) =>
      m.months
        .filter(
          (mm) =>
            lastTwo.has(mm.month) && mm.state !== "live" && mm.met === false,
        )
        .map((mm) => mm.month),
    ),
  ).size;
  const lastOfKind =
    policy.excusedWindows
      .filter((w) => w.kind === kind)
      .map((w) => w.from)
      .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
  return { missed, months, lastOfKind };
}

export type SlaTreatment = "counted" | "lenient" | "excused" | "unmeasured";

export const slaTreatmentLabels: Record<SlaTreatment, string> = {
  counted: "Counted",
  lenient: "Slow, counted as up",
  excused: "Excused",
  unmeasured: "Not measured",
};

/** Weighted ms per treatment, in label order, leaving out treatments with none. */
export function slaTreatmentTotals(
  episodes: readonly { treatment: SlaTreatment; weightedMs: number }[],
): { treatment: SlaTreatment; ms: number }[] {
  const sums = new Map<SlaTreatment, number>();
  for (const e of episodes) {
    sums.set(e.treatment, (sums.get(e.treatment) ?? 0) + e.weightedMs);
  }
  return (Object.keys(slaTreatmentLabels) as SlaTreatment[]).flatMap((t) => {
    const ms = sums.get(t) ?? 0;
    return ms > 0 ? [{ treatment: t, ms }] : [];
  });
}

/** `"2026-11-01"`, -1 → `"2026-10-01"`. */
export function shiftSlaMonth(month: string, by: number): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + by, 1)).toISOString().slice(0, 10);
}

/** The `count` complete months before `now` in `timeZone`, newest first, as `"2026-10-01"`. */
export function completeSlaMonths(
  timeZone: string,
  count: number,
  now = new Date(),
): string[] {
  const current = slaMonthOf(now, timeZone);
  return Array.from({ length: count }, (_, i) =>
    shiftSlaMonth(current, -1 - i),
  );
}

/** `"Nov 4, 2026, 14:05 UTC"` in `timeZone`, for printed documents. */
export function formatSlaInstant(date: Date, timeZone: string): string {
  return new Date(date).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone,
    timeZoneName: "short",
  });
}
