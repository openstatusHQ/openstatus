"use client";

import { formatMilliseconds } from "@/lib/formatter";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartTooltip,
  ChartTooltipContent,
} from "@openstatus/ui/components/ui/chart";
import { Skeleton } from "@openstatus/ui/components/ui/skeleton";
import { cn } from "@openstatus/ui/lib/utils";
import { useState } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import type { AxisDomain } from "recharts/types/util/types";
import { ChartLegendBadge } from "./chart-legend-badge";
import { ChartTooltipNumber } from "./chart-tooltip-number";

const chartConfig = {
  p50Latency: {
    label: "p50",
    color: "var(--chart-1)",
  },
  p75Latency: {
    label: "p75",
    color: "var(--chart-2)",
  },
  p90Latency: {
    label: "p90",
    color: "var(--chart-4)",
  },
  p95Latency: {
    label: "p95",
    color: "var(--chart-3)",
  },
  p99Latency: {
    label: "p99",
    color: "var(--chart-5)",
  },
} satisfies ChartConfig;

function avg(values: number[]) {
  return Math.round(
    values.reduce((acc, curr) => acc + curr, 0) / values.length,
  );
}

function formatAnnotation(values: number[]) {
  if (values.length === 0) return "N/A";
  return formatMilliseconds(avg(values));
}

export function ChartAreaPercentiles({
  className,
  singleSeries,
  xAxisHide = true,
  legendVerticalAlign = "bottom",
  legendClassName,
  yAxisDomain = ["dataMin", "dataMax"],
  data,
}: {
  className?: string;
  singleSeries?: boolean;
  xAxisHide?: boolean;
  legendVerticalAlign?: "top" | "bottom";
  legendClassName?: string;
  yAxisDomain?: AxisDomain;
  data: {
    timestamp: string;
    p50Latency: number;
    p75Latency: number;
    p90Latency: number;
    p95Latency: number;
    p99Latency: number;
  }[];
}) {
  const [activeSeries, setActiveSeries] = useState<
    Array<keyof typeof chartConfig>
  >(["p75Latency"]);

  const annotation = {
    p50Latency: formatAnnotation(data.map((item) => item.p50Latency)),
    p75Latency: formatAnnotation(data.map((item) => item.p75Latency)),
    p90Latency: formatAnnotation(data.map((item) => item.p90Latency)),
    p95Latency: formatAnnotation(data.map((item) => item.p95Latency)),
    p99Latency: formatAnnotation(data.map((item) => item.p99Latency)),
  };

  return (
    <ChartContainer
      config={chartConfig}
      className={cn("h-[100px] w-full", className)}
    >
      <AreaChart
        accessibilityLayer
        data={data}
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
              annotation={annotation}
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
              className="w-[200px]"
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
            <stop
              offset="5%"
              stopColor="var(--color-p50Latency)"
              stopOpacity={0.8}
            />
            <stop
              offset="95%"
              stopColor="var(--color-p50Latency)"
              stopOpacity={0.1}
            />
          </linearGradient>
          <linearGradient id="fillP75" x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="5%"
              stopColor="var(--color-p75Latency)"
              stopOpacity={0.8}
            />
            <stop
              offset="95%"
              stopColor="var(--color-p75Latency)"
              stopOpacity={0.1}
            />
          </linearGradient>
          <linearGradient id="fillP90" x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="5%"
              stopColor="var(--color-p90Latency)"
              stopOpacity={0.8}
            />
            <stop
              offset="95%"
              stopColor="var(--color-p90Latency)"
              stopOpacity={0.1}
            />
          </linearGradient>
          <linearGradient id="fillP95" x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="5%"
              stopColor="var(--color-p95Latency)"
              stopOpacity={0.8}
            />
            <stop
              offset="95%"
              stopColor="var(--color-p95Latency)"
              stopOpacity={0.1}
            />
          </linearGradient>
          <linearGradient id="fillP99" x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="5%"
              stopColor="var(--color-p99Latency)"
              stopOpacity={0.8}
            />
            <stop
              offset="95%"
              stopColor="var(--color-p99Latency)"
              stopOpacity={0.1}
            />
          </linearGradient>
        </defs>
        <Area
          hide={!activeSeries.includes("p50Latency")}
          dataKey="p50Latency"
          type="monotone"
          stroke="var(--color-p50Latency)"
          fill="url(#fillP50)"
          fillOpacity={0.4}
          dot={false}
          yAxisId="percentile"
          connectNulls
        />
        <Area
          hide={!activeSeries.includes("p75Latency")}
          dataKey="p75Latency"
          type="monotone"
          stroke="var(--color-p75Latency)"
          fill="url(#fillP75)"
          fillOpacity={0.4}
          dot={false}
          yAxisId="percentile"
          connectNulls
        />
        {/* <Area
          hide={!activeSeries.includes("p90Latency")}
          dataKey="p90Latency"
          type="monotone"
          stroke="var(--color-p90Latency)"
          fill="url(#fillP90)"
          fillOpacity={0.4}
          dot={false}
          yAxisId="percentile"
          connectNulls
        /> */}
        <Area
          hide={!activeSeries.includes("p95Latency")}
          dataKey="p95Latency"
          type="monotone"
          stroke="var(--color-p95Latency)"
          fill="url(#fillP95)"
          fillOpacity={0.4}
          dot={false}
          yAxisId="percentile"
          connectNulls
        />
        <Area
          hide={!activeSeries.includes("p99Latency")}
          dataKey="p99Latency"
          type="monotone"
          stroke="var(--color-p99Latency)"
          fill="url(#fillP99)"
          fillOpacity={0.4}
          dot={false}
          yAxisId="percentile"
          connectNulls
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
      </AreaChart>
    </ChartContainer>
  );
}

export function ChartAreaPercentilesSkeleton({
  className,
  ...props
}: React.ComponentProps<typeof Skeleton>) {
  return (
    <Skeleton
      className={cn("h-[100px] w-full rounded-lg", className)}
      {...props}
    />
  );
}
