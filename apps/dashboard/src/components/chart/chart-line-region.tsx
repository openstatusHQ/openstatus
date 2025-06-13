"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  // XAxis,
  YAxis,
} from "recharts";

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
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

export function ChartLineRegion({ className }: { className?: string }) {
  const chartData = Array.from({ length: 30 }, (_, i) => ({
    timestamp: new Date(
      new Date().setMinutes(new Date().getMinutes() - i),
    ).toLocaleString("default", {
      hour: "numeric",
      minute: "numeric",
    }),
    latency: Math.floor(Math.random() * 100) * 100,
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
