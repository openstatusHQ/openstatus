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
import { mapLatency, type PERCENTILES } from "@/data/metrics.client";
import { flyRegions } from "@openstatus/db/src/schema/constants";

const chartConfig = {
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
  percentile,
  regions,
}: {
  monitorId: string;
  degradedAfter: number | null;
  percentile: (typeof PERCENTILES)[number];
  period: "1d" | "7d" | "14d";
  type: "http" | "tcp";
  regions: (typeof flyRegions)[number][];
}) {
  const trpc = useTRPC();

  const { data: latency } = useQuery(
    trpc.tinybird.metricsLatency.queryOptions({
      monitorId,
      period,
      type,
      regions,
    })
  );

  const refinedLatency = latency ? mapLatency(latency, percentile) : [];

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
