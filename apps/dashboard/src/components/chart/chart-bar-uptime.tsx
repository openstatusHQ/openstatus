"use client";

import { Bar, BarChart, Cell, CartesianGrid, XAxis, YAxis } from "recharts";

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
import { mapUptime, PERIODS } from "@/data/metrics.client";
import { Region } from "@openstatus/db/src/schema/constants";
import { endOfDay, startOfDay, subDays } from "date-fns";

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

const periodToInterval = {
  "1d": 60,
  "7d": 240,
  "14d": 480,
} satisfies Record<(typeof PERIODS)[number], number>;

const periodToFromDate = {
  "1d": startOfDay(subDays(new Date(), 1)),
  "7d": startOfDay(subDays(new Date(), 7)),
  "14d": startOfDay(subDays(new Date(), 14)),
} satisfies Record<(typeof PERIODS)[number], Date>;

export function ChartBarUptime({
  monitorId,
  period,
  type,
  regions,
}: {
  monitorId: string;
  period: (typeof PERIODS)[number];
  type: "http" | "tcp";
  regions: Region[];
}) {
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
    })
  );

  const refinedUptime = uptime ? mapUptime(uptime) : [];

  return (
    <ChartContainer config={chartConfig} className="h-[130px] w-full">
      <BarChart accessibilityLayer data={refinedUptime} barCategoryGap={2}>
        <CartesianGrid vertical={false} />
        <ChartTooltip
          cursor={false}
          content={<ChartTooltipContent indicator="dot" />}
        />
        <Bar dataKey="ok" stackId="a" fill="var(--color-ok)" minPointSize={2}>
          {refinedUptime.map((_, idx) => (
            <Cell key={`ok-${idx}`} fill="var(--color-ok)" />
          ))}
        </Bar>

        <Bar dataKey="error" stackId="a" fill="var(--color-error)">
          {refinedUptime.map(({ total, error }, idx) => (
            <Cell
              key={`error-${idx}`}
              fill="var(--color-error)"
              height={error ? Math.max(3, (error / total) * 100) : 0}
            />
          ))}
        </Bar>

        <Bar dataKey="degraded" stackId="a" fill="var(--color-degraded)">
          {refinedUptime.map(({ total, degraded }, idx) => (
            <Cell
              key={`degraded-${idx}`}
              fill="var(--color-degraded)"
              height={degraded ? Math.max(3, (degraded / total) * 100) : 0}
            />
          ))}
        </Bar>
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
