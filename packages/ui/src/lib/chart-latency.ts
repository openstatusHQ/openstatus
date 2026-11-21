export type ChartLocale = { locale?: string; timeZone?: string };

export type LatencyRegionSeries = {
  region: string;
  /** Milliseconds per bucket, aligned with the chart's timestamps; null is a gap. */
  values: (number | null)[];
};

export type LatencyRegionRow = { timestamp: number } & Record<
  string,
  number | null
>;

/** One row per bucket, each series under `s<index>`. */
export function toLatencyRegionRows(
  timestamps: number[],
  series: LatencyRegionSeries[],
): LatencyRegionRow[] {
  return timestamps.map((timestamp, bucket) => {
    const row: LatencyRegionRow = { timestamp };
    series.forEach((s, i) => {
      row[`s${i}`] = s.values[bucket] ?? null;
    });
    return row;
  });
}

const DEFAULT_LOCALE = "en-US";

function clock(timestamp: number, timeZone?: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
    timeZone,
  }).formatToParts(timestamp);
  const value = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  return { hour: value("hour"), minute: value("minute") };
}

// Axis ticks only carry what the range can't imply (tooltip has the full date):
// time of day on 1d, the date at midnight and for daily buckets, both otherwise.
export function formatChartTick(
  timestamp: number,
  window: { timeRange: string; intervalMinutes: number },
  { locale = DEFAULT_LOCALE, timeZone }: ChartLocale = {},
): string {
  const { hour, minute } = clock(timestamp, timeZone);
  const format = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(locale, { ...options, timeZone }).format(timestamp);
  if (
    window.intervalMinutes >= 1440 ||
    (window.timeRange === "1d" && hour === 0 && minute === 0)
  ) {
    return format({ month: "short", day: "numeric" });
  }
  if (window.timeRange === "1d") {
    return format({ hour: "numeric", minute: "numeric" });
  }
  return format({
    month: "short",
    day: "numeric",
    hour: "numeric",
    ...(minute ? { minute: "numeric" } : {}),
  });
}

export function formatChartDateTime(
  timestamp: number,
  { locale = DEFAULT_LOCALE, timeZone }: ChartLocale = {},
): string {
  return new Intl.DateTimeFormat(locale, {
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    timeZone,
  }).format(timestamp);
}
