import { db as defaultDb } from "@openstatus/db";
import { selectMonitorSchema } from "@openstatus/db/src/schema";

import { type ServiceContext, defaultTb } from "../context";
import { ValidationError } from "../errors";
import { getMonitorInWorkspace } from "./internal";
import { GetMonitorSummaryInput, type MonitorTimeRange } from "./schemas";

export type GetMonitorSummaryResult = {
  monitorId: number;
  timeRange: MonitorTimeRange;
  regions: string[];
  totalSuccessful: number;
  totalDegraded: number;
  totalFailed: number;
  p50: number;
  p75: number;
  p90: number;
  p95: number;
  p99: number;
  lastPingAt: string;
};

type MetricsRow = {
  p50Latency: number | null;
  p75Latency: number | null;
  p90Latency: number | null;
  p95Latency: number | null;
  p99Latency: number | null;
  count: number;
  success: number;
  degraded: number;
  error: number;
  lastTimestamp: number | null;
};

type SupportedJobType = "http" | "tcp" | "dns";

function fetchMetrics(
  tb: NonNullable<ServiceContext["tb"]>,
  jobType: SupportedJobType,
  timeRange: MonitorTimeRange,
  params: { monitorId: string; regions?: string[] },
): Promise<{ data: MetricsRow[] }> {
  const pipe = {
    http: {
      "1d": tb.httpMetricsDaily,
      "7d": tb.httpMetricsWeekly,
      "14d": tb.httpMetricsBiweekly,
    },
    tcp: {
      "1d": tb.tcpMetricsDaily,
      "7d": tb.tcpMetricsWeekly,
      "14d": tb.tcpMetricsBiweekly,
    },
    dns: {
      "1d": tb.dnsMetricsDaily,
      "7d": tb.dnsMetricsWeekly,
      "14d": tb.dnsMetricsBiweekly,
    },
  }[jobType][timeRange];
  return pipe(params);
}

/**
 * Aggregate latency + success/degraded/error counts over a time window.
 * Reads from Tinybird metrics pipes. Workspace-scoped.
 */
export async function getMonitorSummary(args: {
  ctx: ServiceContext;
  input: GetMonitorSummaryInput;
}): Promise<GetMonitorSummaryResult> {
  const { ctx } = args;
  const input = GetMonitorSummaryInput.parse(args.input);
  const db = ctx.db ?? defaultDb;

  const record = await getMonitorInWorkspace({
    tx: db,
    id: input.monitorId,
    workspaceId: ctx.workspace.id,
  });
  const parsed = selectMonitorSchema.parse(record);

  if (
    parsed.jobType !== "http" &&
    parsed.jobType !== "tcp" &&
    parsed.jobType !== "dns"
  ) {
    throw new ValidationError(
      `getMonitorSummary does not support jobType '${parsed.jobType}'`,
    );
  }

  const regions =
    input.regions && input.regions.length > 0 ? input.regions : parsed.regions;

  const result = await fetchMetrics(
    ctx.tb ?? defaultTb,
    parsed.jobType,
    input.timeRange,
    {
      monitorId: String(record.id),
      regions: regions.length > 0 ? regions : undefined,
    },
  );

  const row = result.data[0];
  if (!row) {
    return {
      monitorId: record.id,
      timeRange: input.timeRange,
      regions,
      totalSuccessful: 0,
      totalDegraded: 0,
      totalFailed: 0,
      p50: 0,
      p75: 0,
      p90: 0,
      p95: 0,
      p99: 0,
      lastPingAt: "",
    };
  }

  return {
    monitorId: record.id,
    timeRange: input.timeRange,
    regions,
    totalSuccessful: row.success ?? 0,
    totalDegraded: row.degraded ?? 0,
    totalFailed: row.error ?? 0,
    p50: Math.round(row.p50Latency ?? 0),
    p75: Math.round(row.p75Latency ?? 0),
    p90: Math.round(row.p90Latency ?? 0),
    p95: Math.round(row.p95Latency ?? 0),
    p99: Math.round(row.p99Latency ?? 0),
    lastPingAt: row.lastTimestamp
      ? new Date(row.lastTimestamp).toISOString()
      : "",
  };
}
