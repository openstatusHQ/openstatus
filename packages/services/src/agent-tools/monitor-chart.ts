import { z } from "zod";

import {
  type GetMonitorLatencySeriesResult,
  getMonitorLatencySeries,
  monitorTimeRange,
} from "../monitor";
import type { AgentTool } from "./types";
import { dashboardUrl } from "./urls";

export const monitorChartPercentiles = [
  "p50",
  "p75",
  "p90",
  "p95",
  "p99",
] as const;
type Percentile = (typeof monitorChartPercentiles)[number];

// One line per region; past this the chart stops being readable.
export const MAX_CHART_REGIONS = 6;

const RenderMonitorChartInput = z.object({
  monitorId: z
    .number()
    .int()
    .describe("Monitor id (numeric). Resolve via list_monitors — never guess."),
  timeRange: z
    .enum(monitorTimeRange)
    .default("1d")
    .describe("Lookback window: 1d (default), 7d, 14d."),
  percentile: z
    .enum(monitorChartPercentiles)
    .default("p95")
    .describe("Latency percentile to plot (default p95)."),
  regions: z
    .array(z.string().max(64))
    .max(MAX_CHART_REGIONS)
    .optional()
    .describe(
      `Region codes to plot, e.g. ["fra","iad"], at most ${MAX_CHART_REGIONS}. Omit for the monitor's regions; with more than ${MAX_CHART_REGIONS}, the slowest are shown.`,
    ),
});

const RenderMonitorChartOutput = z.object({
  monitorId: z.number().int(),
  name: z.string(),
  dashboardUrl: z.string(),
  jobType: z.string(),
  timeRange: z.enum(monitorTimeRange),
  percentile: z.enum(monitorChartPercentiles),
  intervalMinutes: z.number().int(),
  timestamps: z
    .array(z.number().int())
    .describe("Bucket starts, epoch milliseconds, oldest first."),
  series: z.array(
    z.object({
      region: z.string(),
      values: z
        .array(z.number().int().nullable())
        .describe("Milliseconds per bucket, aligned with `timestamps`."),
    }),
  ),
  omittedRegions: z.array(z.string()),
  peak: z
    .object({
      region: z.string(),
      value: z.number().int(),
      timestamp: z.number().int(),
    })
    .nullable(),
});

export type MonitorChartModel = z.infer<typeof RenderMonitorChartOutput>;

export function meanLatency(values: (number | null)[]): number {
  const present = values.filter((value) => value !== null);
  if (present.length === 0) return 0;
  return Math.round(
    present.reduce((sum, value) => sum + value, 0) / present.length,
  );
}

/** Pivot per-region rows into aligned series, keeping at most `MAX_CHART_REGIONS`. */
export function toMonitorChartModel(
  result: GetMonitorLatencySeriesResult,
  percentile: Percentile,
): MonitorChartModel {
  const timestamps = [
    ...new Set(result.points.map((point) => point.timestamp)),
  ].sort((a, b) => a - b);
  const index = new Map(timestamps.map((timestamp, i) => [timestamp, i]));

  const byRegion = new Map<string, (number | null)[]>();
  for (const point of result.points) {
    let values = byRegion.get(point.region);
    if (!values) {
      values = timestamps.map(() => null);
      byRegion.set(point.region, values);
    }
    values[index.get(point.timestamp) as number] = point[percentile];
  }

  const slowestFirst = [...byRegion.entries()].sort(
    (a, b) => meanLatency(b[1]) - meanLatency(a[1]) || a[0].localeCompare(b[0]),
  );
  const shown = slowestFirst.slice(0, MAX_CHART_REGIONS);
  const omitted = slowestFirst.slice(MAX_CHART_REGIONS);

  let peak: MonitorChartModel["peak"] = null;
  for (const [region, values] of shown) {
    values.forEach((value, i) => {
      if (value !== null && (peak === null || value > peak.value)) {
        peak = { region, value, timestamp: timestamps[i] as number };
      }
    });
  }

  return {
    monitorId: result.monitorId,
    name: result.name,
    dashboardUrl: dashboardUrl(`/monitors/${result.monitorId}/overview`),
    jobType: result.jobType,
    timeRange: result.timeRange,
    percentile,
    intervalMinutes: result.interval,
    timestamps,
    // alphabetical, so a region keeps its colour when the range changes
    series: shown
      .map(([region, values]) => ({ region, values }))
      .sort((a, b) => a.region.localeCompare(b.region)),
    omittedRegions: omitted.map(([region]) => region).sort(),
    peak,
  };
}

function formatInterval(minutes: number): string {
  return minutes % 60 === 0 ? `${minutes / 60}h` : `${minutes}min`;
}

/** The chart as prose, for a surface that cannot draw it. */
export function summarizeMonitorChart(model: MonitorChartModel): string {
  const head = `${model.percentile} latency for "${model.name}" over the last ${model.timeRange} (${formatInterval(model.intervalMinutes)} buckets).`;
  if (model.peak === null) {
    return `${head} No checks recorded in this window. Dashboard: ${model.dashboardUrl}`;
  }
  const lines = [
    head,
    `Peak: ${model.peak.value} ms in ${model.peak.region} at ${new Date(model.peak.timestamp).toISOString()}.`,
    `Mean by region: ${model.series
      .map((s) => `${s.region} ${meanLatency(s.values)} ms`)
      .join(", ")}.`,
  ];
  if (model.omittedRegions.length > 0) {
    lines.push(
      `Not plotted (faster regions): ${model.omittedRegions.join(", ")}.`,
    );
  }
  lines.push(`Dashboard: ${model.dashboardUrl}`);
  return lines.join("\n");
}

export const renderMonitorChartTool: AgentTool<
  z.infer<typeof RenderMonitorChartInput>,
  MonitorChartModel
> = {
  name: "render_monitor_chart",
  description:
    "Chart a monitor's latency over time, one line per region, with the peak. Surfaces that can draw it show an interactive chart in the conversation. Use it when the user asks to see, chart or plot latency; use get_monitor_summary for a single aggregate.",
  scope: "monitors:read",
  destructive: false,
  // MCP serves it behind `?experimental=1` instead, see apps/server routes/mcp/server.ts
  feature: "monitor-chart",
  inputSchema: RenderMonitorChartInput,
  outputSchema: RenderMonitorChartOutput,
  async run({ ctx, input }) {
    const result = await getMonitorLatencySeries({
      ctx,
      input: {
        monitorId: input.monitorId,
        timeRange: input.timeRange,
        regions: input.regions,
      },
    });
    return toMonitorChartModel(result, input.percentile);
  },
};
