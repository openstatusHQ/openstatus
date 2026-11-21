"use client";

import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@openstatus/ui/components/ui/chart";
import {
  type ChartLocale,
  type LatencyRegionSeries,
  formatChartDateTime,
  formatChartTick,
  toLatencyRegionRows,
} from "@openstatus/ui/lib/chart-latency";
import { cn } from "@openstatus/ui/lib/utils";
import type { ReactNode } from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

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

export type ChartLatencyRegionsEmpty = "no-checks" | "no-latency";

const EMPTY_TEXT: Record<ChartLatencyRegionsEmpty, string> = {
  "no-checks": "No checks recorded in this window",
  "no-latency": "No latency recorded: every check failed",
};

/**
 * Latency per region over time, one line each. Presentational only: it also
 * renders inside sandboxed MCP Apps views, which have no network access.
 */
export function ChartLatencyRegions({
  timestamps,
  series,
  timeRange,
  intervalMinutes,
  locale,
  renderEmpty,
  className,
}: {
  timestamps: number[];
  series: LatencyRegionSeries[];
  timeRange: string;
  intervalMinutes: number;
  locale?: ChartLocale;
  renderEmpty?: (reason: ChartLatencyRegionsEmpty, text: string) => ReactNode;
  className?: string;
}) {
  const hasLatency = series.some((s) => s.values.some((v) => v !== null));
  if (!hasLatency) {
    const reason = timestamps.length === 0 ? "no-checks" : "no-latency";
    return renderEmpty ? (
      renderEmpty(reason, EMPTY_TEXT[reason])
    ) : (
      <div
        data-slot="chart-empty"
        className={cn(
          "text-muted-foreground flex h-[250px] items-center justify-center rounded-md border border-dashed text-sm",
          className,
        )}
      >
        {EMPTY_TEXT[reason]}
      </div>
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
    <ChartContainer
      config={chartConfig}
      className={cn("h-[250px] w-full", className)}
    >
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
            formatChartTick(value, { timeRange, intervalMinutes }, locale)
          }
        />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              indicator="dot"
              labelFormatter={(_, payload) =>
                formatChartDateTime(payload[0]?.payload.timestamp, locale)
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
