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

/** Downtime a target allows in a 30-day month, e.g. `"3h 36m"`. */
export function allowedDowntime(target: number): string {
  const seconds = Math.round((MONTH_SECONDS * (100_000 - target)) / 100_000);
  if (seconds === 0) return "0s";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const parts = h > 0 ? [`${h}h`, m > 0 ? `${m}m` : null] : [`${m}m`, `${s}s`];
  return parts.filter((p) => p !== null && p !== "0m").join(" ");
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

export const excusedKindLabels: Record<MonitorSlaExcusedWindowKind, string> = {
  maintenance: "Maintenance",
  emergency: "Emergency",
  third_party: "Third party",
  customer_caused: "Customer caused",
  force_majeure: "Force majeure",
  other: "Other",
};

function utc(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
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

/** `"Nov 4, 22:00 – 23:00"` in UTC; both dates when it spans days. */
export function formatExcusedWindow(from: Date, to: Date): string {
  const a = utc(from);
  const b = utc(to);
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
