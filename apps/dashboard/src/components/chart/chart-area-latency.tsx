"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Label,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";

import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { ChartTooltipNumber } from "./chart-tooltip-number";

const chartData = Array.from({ length: 30 }, (_, i) => ({
  timestamp: new Date(
    new Date().setMinutes(new Date().getMinutes() - i)
  ).toLocaleString("default", {
    hour: "numeric",
    minute: "numeric",
  }),
  dns: Math.floor(Math.random() * 100) * 8,
  connect: Math.floor(Math.random() * 100) * 40,
  ttfb: Math.floor(Math.random() * 100) * 80,
  download: Math.floor(Math.random() * 100) * 50,
})).reverse();

const chartConfig = {
  dns: {
    label: "DNS",
    color: "var(--chart-1)",
  },
  connect: {
    label: "Connect",
    color: "var(--chart-2)",
  },
  ttfb: {
    label: "TTFB",
    color: "var(--chart-3)",
  },
  download: {
    label: "Download",
    color: "var(--chart-4)",
  },
} satisfies ChartConfig;

export function ChartAreaLatency() {
  return (
    <ChartContainer config={chartConfig} className="h-[250px] w-full">
      <AreaChart accessibilityLayer data={chartData}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="timestamp"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          //   tickFormatter={(value) => value.slice(0, 3)}
        />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              indicator="dot"
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
        <Area
          dataKey="dns"
          type="monotone"
          fill="var(--color-dns)"
          fillOpacity={0.4}
          stroke="var(--color-dns)"
          stackId="a"
        />
        <Area
          dataKey="connect"
          type="monotone"
          fill="var(--color-connect)"
          fillOpacity={0.4}
          stroke="var(--color-connect)"
          stackId="a"
        />
        <Area
          dataKey="ttfb"
          type="monotone"
          fill="var(--color-ttfb)"
          fillOpacity={0.4}
          stroke="var(--color-ttfb)"
          stackId="a"
        />
        <Area
          dataKey="download"
          type="monotone"
          fill="var(--color-download)"
          fillOpacity={0.4}
          stroke="var(--color-download)"
          stackId="a"
        />
        <ReferenceLine y={10_000} stroke="var(--warning)" strokeDasharray="3 3">
          <Label
            value="Degraded"
            position="insideBottomRight"
            fill="var(--warning)"
          />
        </ReferenceLine>
        <YAxis
          domain={["dataMin", "dataMax"]}
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          orientation="right"
          tickFormatter={(value) => `${value}ms`}
        />
        <ChartLegend content={<ChartLegendContent />} />
      </AreaChart>
    </ChartContainer>
  );
}
