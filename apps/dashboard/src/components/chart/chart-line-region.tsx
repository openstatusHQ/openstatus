"use client";

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { cn } from "@/lib/utils";
import { ChartTooltipNumber } from "./chart-tooltip-number";

const chartConfig = {
  latency: {
    label: "Latency",
    color: "var(--success)",
  },
} satisfies ChartConfig;

export type TrendPoint = {
  timestamp: number; // unix millis
  latency: number; // milliseconds
};

export function ChartLineRegion({
  className,
  data,
}: {
  className?: string;
  data: TrendPoint[];
}) {
  const trendData = data ?? [];

  const chartData = trendData.map((d) => ({
    timestamp: new Date(d.timestamp).toLocaleString("default", {
      hour: "numeric",
      minute: "numeric",
      // TODO: add day/month
    }),
    latency: d.latency,
  }));

  return (
    <ChartContainer
      config={chartConfig}
      className={cn("h-[100px] w-full", className)}
    >
      <LineChart
        accessibilityLayer
        data={chartData}
        margin={{
          left: 12,
          right: 12,
        }}
      >
        <CartesianGrid vertical={false} />
        <XAxis dataKey="timestamp" hide />
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
        <Line
          dataKey="latency"
          type="monotone"
          stroke="var(--color-latency)"
          strokeWidth={2}
          dot={false}
        />
        <YAxis
          domain={["dataMin", "dataMax"]}
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          orientation="right"
          tickFormatter={(value) => `${value}ms`}
        />
      </LineChart>
    </ChartContainer>
  );
}
