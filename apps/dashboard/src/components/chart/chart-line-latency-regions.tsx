"use client";

import { Trend } from "@openstatus/icons";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@openstatus/ui/components/ui/chart";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

import {
  EmptyStateMedia,
  EmptyStateTitle,
} from "@/components/content/empty-state";
import type { PERIODS } from "@/data/metrics.client";
import { formatAxisTick, formatDateTime } from "@/lib/formatter";

import { ChartEmpty } from "./chart-empty";
import {
  type LatencyRegionSeries,
  toLatencyRegionRows,
} from "./chart-line-latency-regions.data";
import { ChartTooltipNumber } from "./chart-tooltip-number";

// The theme has five chart colours; a sixth line falls back to the text colour.
const SERIES_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--foreground)",
];

export function ChartLineLatencyRegions({
  timestamps,
  series,
  period,
  intervalMinutes,
}: {
  timestamps: number[];
  series: LatencyRegionSeries[];
  period: (typeof PERIODS)[number];
  intervalMinutes: number;
}) {
  const hasLatency = series.some((s) => s.values.some((v) => v !== null));
  if (!hasLatency) {
    return (
      <ChartEmpty>
        <EmptyStateMedia>
          <Trend />
        </EmptyStateMedia>
        <EmptyStateTitle>
          {timestamps.length === 0
            ? "No checks recorded in this window"
            : "No latency recorded: every check failed"}
        </EmptyStateTitle>
      </ChartEmpty>
    );
  }

  // keyed by position: a private location's name is not a valid CSS variable
  const chartConfig: ChartConfig = Object.fromEntries(
    series.map((s, i) => [
      `s${i}`,
      { label: s.region, color: SERIES_COLORS[i % SERIES_COLORS.length] },
    ]),
  );

  return (
    <ChartContainer config={chartConfig} className="h-[250px] w-full">
      <LineChart
        accessibilityLayer
        data={toLatencyRegionRows(timestamps, series)}
      >
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="timestamp"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={24}
          tickFormatter={(value) =>
            formatAxisTick(new Date(value), period, intervalMinutes)
          }
        />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              indicator="dot"
              labelFormatter={(_, payload) =>
                formatDateTime(new Date(payload[0]?.payload.timestamp))
              }
              formatter={(value, name) => (
                <ChartTooltipNumber
                  chartConfig={chartConfig}
                  value={value}
                  name={name}
                />
              )}
            />
          }
        />
        {series.map((s, i) => (
          <Line
            key={s.region}
            dataKey={`s${i}`}
            type="linear"
            stroke={`var(--color-s${i})`}
            strokeWidth={2}
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
          />
        ))}
        <YAxis
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          orientation="right"
          tickFormatter={(value) => `${value}ms`}
        />
        {series.length > 1 ? (
          <ChartLegend content={<ChartLegendContent />} />
        ) : null}
      </LineChart>
    </ChartContainer>
  );
}
