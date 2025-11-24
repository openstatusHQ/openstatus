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
import {
  type PERIODS,
  mapUptime,
  periodToFromDate,
  periodToInterval,
} from "@/data/metrics.client";
import { useIsMobile } from "@/hooks/use-mobile";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { endOfDay } from "date-fns";

const chartConfig = {
  ok: {
    label: "Success",
    color: "var(--color-success)",
  },
  degraded: {
    label: "Degraded",
    color: "var(--color-warning)",
  },
  error: {
    label: "Error",
    color: "var(--color-destructive)",
  },
} satisfies ChartConfig;

export function ChartBarUptime({
  monitorId,
  period,
  type,
  regions,
}: {
  monitorId: string;
  period: (typeof PERIODS)[number];
  type: "http" | "tcp";
  regions: string[] | undefined;
}) {
  const isMobile = useIsMobile();
  const trpc = useTRPC();
  const fromDate = periodToFromDate[period];
  const toDate = endOfDay(new Date());
  const interval = periodToInterval[period];

  const { data: uptime } = useQuery(
    trpc.tinybird.uptime.queryOptions({
      monitorId,
      fromDate: fromDate.toISOString(),
      toDate: toDate.toISOString(),
      regions,
      interval,
      type,
    }),
  );

  const refinedUptime = uptime ? mapUptime(uptime) : [];

  return (
    <ChartContainer config={chartConfig} className="h-[130px] w-full">
      <BarChart
        accessibilityLayer
        data={refinedUptime}
        barCategoryGap={isMobile ? 0 : 2}
      >
        <CartesianGrid vertical={false} />
        <ChartTooltip
          cursor={false}
          content={<ChartTooltipContent indicator="dot" />}
        />
        <Bar dataKey="ok" stackId="a" fill="var(--color-ok)" />
        <Bar dataKey="error" stackId="a" fill="var(--color-error)" />
        <Bar dataKey="degraded" stackId="a" fill="var(--color-degraded)" />
        <YAxis
          domain={["dataMin", "dataMax"]}
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          orientation="right"
        />
        <XAxis
          dataKey="interval"
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
