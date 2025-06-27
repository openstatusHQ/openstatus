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
import { useTRPC } from "@/lib/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { mapLatency } from "@/data/metrics.client";

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
  latency: {
    label: "Latency",
    color: "var(--success)",
  },
} satisfies ChartConfig;

// TODO: create new pipes for timing phase metrics

export function ChartAreaLatency({
  monitorId,
  degradedAfter,
  period,
  type,
}: {
  monitorId: string;
  degradedAfter: number | null;
  period: "1d" | "7d" | "14d";
  type: "http" | "tcp";
}) {
  const trpc = useTRPC();

  const { data: latency } = useQuery(
    trpc.tinybird.metricsLatency.queryOptions({
      monitorId,
      period,
      type,
    })
  );

  const refinedLatency = latency ? mapLatency(latency) : [];

  return (
    <ChartContainer config={chartConfig} className="h-[250px] w-full">
      <AreaChart accessibilityLayer data={refinedLatency}>
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
        {/* <Area
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
        /> */}
        <Area
          dataKey="latency"
          type="monotone"
          fill="var(--color-latency)"
          fillOpacity={0.4}
          stroke="var(--color-latency)"
          stackId="a"
        />
        {degradedAfter ? (
          <ReferenceLine
            y={degradedAfter}
            stroke="var(--warning)"
            strokeDasharray="3 3"
          >
            <Label
              value="Degraded"
              position="insideBottomRight"
              fill="var(--warning)"
            />
          </ReferenceLine>
        ) : null}
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
