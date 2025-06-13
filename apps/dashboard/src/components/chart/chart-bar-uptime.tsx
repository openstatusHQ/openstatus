"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

const chartData = Array.from({ length: 28 }, (_, i) => ({
  timestamp: new Date(
    new Date().setHours(new Date().getHours() - i * 6)
  ).toLocaleString("default", {
    day: "numeric",
    month: "numeric",
    hour: "numeric",
    minute: "numeric",
  }),
  ok: i === 3 || i === 16 ? 172 : 186,
  error: i === 3 ? 14 : 0,
  degraded: i === 16 ? 14 : 0,
})).reverse();

const chartConfig = {
  ok: {
    label: "ok",
    color: "var(--color-success)",
  },
  degraded: {
    label: "degraded",
    color: "var(--color-warning)",
  },
  error: {
    label: "error",
    color: "var(--color-destructive)",
  },
} satisfies ChartConfig;

export function ChartBarUptime() {
  return (
    <ChartContainer config={chartConfig} className="h-[130px] w-full">
      <BarChart accessibilityLayer data={chartData} barCategoryGap={2}>
        <CartesianGrid vertical={false} />
        <ChartTooltip
          cursor={false}
          content={<ChartTooltipContent indicator="dot" />}
        />
        <Bar dataKey="ok" fill="var(--color-ok)" stackId="a" />
        <Bar dataKey="error" fill="var(--color-error)" stackId="a" />
        <Bar dataKey="degraded" fill="var(--color-degraded)" stackId="a" />
        <YAxis
          domain={["dataMin", "dataMax"]}
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          orientation="right"
        />
        <XAxis
          dataKey="timestamp"
          tickLine={false}
          tickMargin={8}
          minTickGap={10}
          axisLine={false}
        />
        <ChartLegend content={<ChartLegendContent />} />
      </BarChart>
    </ChartContainer>
  );
}
