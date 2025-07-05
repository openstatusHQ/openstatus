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
import {
  ChartTooltipNumber,
  ChartTooltipNumberRaw,
} from "./chart-tooltip-number";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { INTERVALS, mapTimingPhases, PERCENTILES } from "@/data/metrics.client";

const chartConfig = {
  dns: {
    label: "DNS",
    color: "var(--chart-1)",
  },
  connect: {
    label: "Connect",
    color: "var(--chart-2)",
  },
  tls: {
    label: "TLS",
    color: "var(--chart-3)",
  },
  ttfb: {
    label: "TTFB",
    color: "var(--chart-4)",
  },
  transfer: {
    label: "Transfer",
    color: "var(--chart-5)",
  },
} satisfies ChartConfig;

// TODO: create new pipes for timing phase metrics

export function ChartAreaTimingPhases({
  monitorId,
  degradedAfter,
  period,
  percentile,
  interval,
  type,
}: {
  monitorId: string;
  degradedAfter: number | null;
  period: "1d" | "7d" | "14d";
  percentile: (typeof PERCENTILES)[number];
  interval: (typeof INTERVALS)[number];
  type: "http";
}) {
  const trpc = useTRPC();

  const { data: timingPhases } = useQuery(
    trpc.tinybird.metricsTimingPhases.queryOptions({
      monitorId,
      period,
      type,
      interval,
    })
  );

  const refinedTimingPhases = timingPhases
    ? mapTimingPhases(timingPhases, percentile)
    : [];

  console.log(refinedTimingPhases);
  return (
    <ChartContainer config={chartConfig} className="h-[250px] w-full">
      <AreaChart accessibilityLayer data={refinedTimingPhases}>
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
          defaultIndex={10}
          content={
            <ChartTooltipContent
              indicator="dot"
              formatter={(value, name, item, index) => {
                if (index !== 4) {
                  return (
                    <ChartTooltipNumber
                      chartConfig={chartConfig}
                      value={value}
                      name={name}
                    />
                  );
                }

                const total =
                  item.payload?.dns +
                  item.payload?.connect +
                  item.payload?.tls +
                  item.payload?.ttfb +
                  item.payload?.transfer;

                return (
                  <>
                    <ChartTooltipNumber
                      chartConfig={chartConfig}
                      value={value}
                      name={name}
                    />
                    <ChartTooltipNumberRaw
                      value={total}
                      label="Total"
                      className="text-foreground flex basis-full items-center border-t text-xs h-0 font-medium"
                    />
                  </>
                );
              }}
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
          dataKey="tls"
          type="monotone"
          fill="var(--color-tls)"
          fillOpacity={0.4}
          stroke="var(--color-tls)"
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
          dataKey="transfer"
          type="monotone"
          fill="var(--color-transfer)"
          fillOpacity={0.4}
          stroke="var(--color-transfer)"
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
