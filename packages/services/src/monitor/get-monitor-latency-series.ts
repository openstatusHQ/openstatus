import { db as defaultDb } from "@openstatus/db";
import { selectMonitorSchema } from "@openstatus/db/src/schema";

import { requireScope } from "../auth";
import { type ServiceContext, defaultTb } from "../context";
import { ValidationError } from "../errors";
import { getMonitorInWorkspace } from "./internal";
import { GetMonitorLatencySeriesInput, type MonitorTimeRange } from "./schemas";

export type MonitorLatencyPoint = {
  region: string;
  /** Bucket start, epoch milliseconds. */
  timestamp: number;
  // null when the bucket recorded no latency, e.g. every check failed
  p50: number | null;
  p75: number | null;
  p90: number | null;
  p95: number | null;
  p99: number | null;
};

export type GetMonitorLatencySeriesResult = {
  monitorId: number;
  name: string;
  jobType: SupportedJobType;
  timeRange: MonitorTimeRange;
  /** Bucket size in minutes actually served. */
  interval: number;
  regions: string[];
  points: MonitorLatencyPoint[];
};

type SupportedJobType = "http" | "tcp" | "dns" | "icmp" | "grpc";

type SeriesRow = {
  region: string;
  timestamp: number;
  p50Latency: number | null;
  p75Latency: number | null;
  p90Latency: number | null;
  p95Latency: number | null;
  p99Latency: number | null;
};

const DAY_MS = 86_400_000;

const TIME_RANGE_DAYS: Record<MonitorTimeRange, number> = {
  "1d": 1,
  "7d": 7,
  "14d": 14,
};

// Same defaults and bounds as the dashboard's latency chart.
const DEFAULT_INTERVAL: Record<MonitorTimeRange, number> = {
  "1d": 60,
  "7d": 240,
  "14d": 480,
};
const MIN_INTERVAL = 5;
const MAX_INTERVAL: Record<MonitorTimeRange, number> = {
  "1d": 240,
  "7d": 1440,
  "14d": 1440,
};

function roundOrNull(value: number | null): number | null {
  return value === null ? null : Math.round(value);
}

function resolveInterval(timeRange: MonitorTimeRange, interval?: number) {
  if (interval === undefined) return DEFAULT_INTERVAL[timeRange];
  return Math.min(Math.max(interval, MIN_INTERVAL), MAX_INTERVAL[timeRange]);
}

function fetchSeries(
  tb: NonNullable<ServiceContext["tb"]>,
  jobType: SupportedJobType,
  timeRange: MonitorTimeRange,
  params: { monitorId: string; interval: number; regions?: string[] },
  window: { from: number; to: number },
): Promise<{ data: SeriesRow[] }> {
  // dns has a single 14d pipe; the window is passed as dates instead
  if (jobType === "dns") {
    return tb.dnsMetricsRegionsBiweekly({
      ...params,
      fromDate: new Date(window.from).toISOString(),
      toDate: new Date(window.to).toISOString(),
    });
  }
  const pipe = {
    http: {
      "1d": tb.httpMetricsRegionsDaily,
      "7d": tb.httpMetricsRegionsWeekly,
      "14d": tb.httpMetricsRegionsBiweekly,
    },
    tcp: {
      "1d": tb.tcpMetricsByIntervalDaily,
      "7d": tb.tcpMetricsByIntervalWeekly,
      "14d": tb.tcpMetricsByIntervalBiweekly,
    },
    icmp: {
      "1d": tb.icmpMetricsByIntervalDaily,
      "7d": tb.icmpMetricsByIntervalWeekly,
      "14d": tb.icmpMetricsByIntervalBiweekly,
    },
    grpc: {
      "1d": tb.grpcMetricsByIntervalDaily,
      "7d": tb.grpcMetricsByIntervalWeekly,
      "14d": tb.grpcMetricsByIntervalBiweekly,
    },
  }[jobType][timeRange];
  return pipe(params);
}

/** Per-region latency percentiles bucketed over time, oldest first. */
export async function getMonitorLatencySeries(args: {
  ctx: ServiceContext;
  input: GetMonitorLatencySeriesInput;
}): Promise<GetMonitorLatencySeriesResult> {
  const { ctx } = args;
  requireScope(ctx, "monitors:read");
  const input = GetMonitorLatencySeriesInput.parse(args.input);

  const record = await getMonitorInWorkspace({
    tx: ctx.db ?? defaultDb,
    id: input.monitorId,
    workspaceId: ctx.workspace.id,
  });
  const parsed = selectMonitorSchema.parse(record);

  if (
    parsed.jobType !== "http" &&
    parsed.jobType !== "tcp" &&
    parsed.jobType !== "dns" &&
    parsed.jobType !== "icmp" &&
    parsed.jobType !== "grpc"
  ) {
    throw new ValidationError(
      `Monitors of type '${parsed.jobType}' record no latency to chart.`,
    );
  }

  const regions =
    input.regions && input.regions.length > 0 ? input.regions : parsed.regions;
  const interval = resolveInterval(input.timeRange, input.interval);
  const to = Date.now();
  const from = to - TIME_RANGE_DAYS[input.timeRange] * DAY_MS;

  const result = await fetchSeries(
    ctx.tb ?? defaultTb,
    parsed.jobType,
    input.timeRange,
    {
      monitorId: String(record.id),
      interval,
      regions: regions.length > 0 ? regions : undefined,
    },
    { from, to },
  );

  // the http pipes filter by region, the by-interval ones may not: filter here too
  const wanted = regions.length > 0 ? new Set(regions) : undefined;
  const points = result.data
    // timestamps are bucket starts, so the first bucket opens before `from`
    .filter((row) => row.timestamp > from - interval * 60_000)
    .filter((row) => !wanted || wanted.has(row.region))
    .map((row) => ({
      region: row.region,
      timestamp: row.timestamp,
      p50: roundOrNull(row.p50Latency),
      p75: roundOrNull(row.p75Latency),
      p90: roundOrNull(row.p90Latency),
      p95: roundOrNull(row.p95Latency),
      p99: roundOrNull(row.p99Latency),
    }))
    .sort((a, b) => a.timestamp - b.timestamp);

  return {
    monitorId: record.id,
    name: parsed.name,
    jobType: parsed.jobType,
    timeRange: input.timeRange,
    interval,
    regions: [...new Set(points.map((point) => point.region))].sort(),
    points,
  };
}
