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
import { useTRPC } from "@/lib/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { mapStatus } from "@/data/metrics.client";

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

export function ChartBarUptime({
  monitorId,
  type,
}: {
  monitorId: string;
  period: "1d" | "7d" | "14d";
  type: "http" | "tcp";
}) {
  const trpc = useTRPC();
  const { data: uptime } = useQuery(
    trpc.tinybird.status.queryOptions({
      monitorId,
      // TODO: use period properly
      period: "45d",
      type,
    })
  );

  const refinedUptime = uptime ? mapStatus(uptime) : [];

  return (
    <ChartContainer config={chartConfig} className="h-[130px] w-full">
      <BarChart accessibilityLayer data={refinedUptime} barCategoryGap={2}>
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
