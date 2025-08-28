"use client";

import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { regionPercentile } from "@/data/region-percentile";
import { formatMilliseconds } from "@/lib/formatter";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import type { AxisDomain } from "recharts/types/util/types";
import { ChartLegendBadge } from "./chart-legend-badge";
import { ChartTooltipNumber } from "./chart-tooltip-number";

const chartConfig = {
  p50: {
    label: "p50",
    color: "var(--chart-1)",
  },
  p75: {
    label: "p75",
    color: "var(--chart-2)",
  },
  p90: {
    label: "p90",
    color: "var(--chart-4)",
  },
  p95: {
    label: "p95",
    color: "var(--chart-3)",
  },
  p99: {
    label: "p99",
    color: "var(--chart-5)",
  },
  error: {
    label: "error",
    color: "var(--destructive)",
  },
} satisfies ChartConfig;

function avg(values: number[]) {
  return Math.round(
    values.reduce((acc, curr) => acc + curr, 0) / values.length,
  );
}

const chartData = regionPercentile;

export function ChartAreaPercentiles({
  className,
  singleSeries,
  xAxisHide = true,
  legendVerticalAlign = "bottom",
  legendClassName,
  withError = false,
  yAxisDomain = ["dataMin", "dataMax"],
}: {
  className?: string;
  singleSeries?: boolean;
  xAxisHide?: boolean;
  legendVerticalAlign?: "top" | "bottom";
  legendClassName?: string;
  withError?: boolean;
  yAxisDomain?: AxisDomain;
}) {
  const [activeSeries, setActiveSeries] = useState<
    Array<keyof typeof chartConfig>
  >(["p75"]);

  return (
    <ChartContainer
      config={chartConfig}
      className={cn("h-[100px] w-full", className)}
    >
      <AreaChart
        accessibilityLayer
        data={chartData}
        margin={{
          left: 0,
          right: 0,
          // NOTE: otherwise the line is cut off
          top: 2,
          bottom: 2,
        }}
      >
        <ChartLegend
          verticalAlign={legendVerticalAlign}
          content={
            <ChartLegendBadge
              handleActive={(item) => {
                setActiveSeries((prev) => {
                  if (item.dataKey) {
                    const key = item.dataKey as keyof typeof chartConfig;
                    if (singleSeries) {
                      return [key];
                    }
                    if (prev.includes(key)) {
                      return prev.filter((item) => item !== key);
                    }
                    return [...prev, key];
                  }
                  return prev;
                });
              }}
              active={activeSeries}
              annotation={{
                p50: formatMilliseconds(avg(chartData.map((item) => item.p50))),
                p75: formatMilliseconds(avg(chartData.map((item) => item.p75))),
                p90: formatMilliseconds(avg(chartData.map((item) => item.p90))),
                p95: formatMilliseconds(avg(chartData.map((item) => item.p95))),
                p99: formatMilliseconds(avg(chartData.map((item) => item.p99))),
              }}
              className={cn("overflow-x-scroll", legendClassName)}
            />
          }
        />
        <CartesianGrid vertical={false} />
        <XAxis dataKey="timestamp" hide={xAxisHide} />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              className="w-[180px]"
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
        <defs>
          <linearGradient id="fillP50" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-p50)" stopOpacity={0.8} />
            <stop offset="95%" stopColor="var(--color-p50)" stopOpacity={0.1} />
          </linearGradient>
          <linearGradient id="fillP75" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-p75)" stopOpacity={0.8} />
            <stop offset="95%" stopColor="var(--color-p75)" stopOpacity={0.1} />
          </linearGradient>
          <linearGradient id="fillP90" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-p90)" stopOpacity={0.8} />
            <stop offset="95%" stopColor="var(--color-p90)" stopOpacity={0.1} />
          </linearGradient>
          <linearGradient id="fillP95" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-p95)" stopOpacity={0.8} />
            <stop offset="95%" stopColor="var(--color-p95)" stopOpacity={0.1} />
          </linearGradient>
          <linearGradient id="fillP99" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-p99)" stopOpacity={0.8} />
            <stop offset="95%" stopColor="var(--color-p99)" stopOpacity={0.1} />
          </linearGradient>
        </defs>
        {withError ? (
          <Area
            dataKey="error"
            type="monotone"
            stroke="var(--color-error)"
            strokeWidth={1}
            fill="var(--color-error)"
            fillOpacity={0.5}
            legendType="none"
            tooltipType="none"
            yAxisId="error"
            dot={false}
            activeDot={false}
          />
        ) : null}
        <Area
          hide={!activeSeries.includes("p50")}
          dataKey="p50"
          type="monotone"
          stroke="var(--color-p50)"
          fill="url(#fillP50)"
          fillOpacity={0.4}
          dot={false}
          yAxisId="percentile"
        />
        <Area
          hide={!activeSeries.includes("p75")}
          dataKey="p75"
          type="monotone"
          stroke="var(--color-p75)"
          fill="url(#fillP75)"
          fillOpacity={0.4}
          dot={false}
          yAxisId="percentile"
        />
        {/* <Area
          hide={!activeSeries.includes("p90")}
          dataKey="p90"
          type="monotone"
          stroke="var(--color-p90)"
          fill="url(#fillP90)"
          fillOpacity={0.4}
          dot={false}
          yAxisId="percentile"
        /> */}
        <Area
          hide={!activeSeries.includes("p95")}
          dataKey="p95"
          type="monotone"
          stroke="var(--color-p95)"
          fill="url(#fillP95)"
          fillOpacity={0.4}
          dot={false}
          yAxisId="percentile"
        />
        <Area
          hide={!activeSeries.includes("p99")}
          dataKey="p99"
          type="monotone"
          stroke="var(--color-p99)"
          fill="url(#fillP99)"
          fillOpacity={0.4}
          dot={false}
          yAxisId="percentile"
        />
        <YAxis
          domain={yAxisDomain}
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          orientation="right"
          yAxisId="percentile"
          tickFormatter={(value) => `${value}ms`}
        />
        <YAxis orientation="left" yAxisId="error" hide />
      </AreaChart>
    </ChartContainer>
  );
}
