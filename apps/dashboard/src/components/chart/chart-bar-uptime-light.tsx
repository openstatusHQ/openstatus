"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { Bar, BarChart, XAxis } from "recharts";

import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { mapUptime } from "@/data/metrics.client";
import { useTRPC } from "@/lib/trpc/client";
import type { Region } from "@openstatus/db/src/schema/constants";
import { useQuery } from "@tanstack/react-query";
// import { startOfDay, subDays } from "date-fns";

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

export function ChartBarUptimeLight({
  monitorId,
  type,
  regions,
}: {
  monitorId: string;
  type: "http" | "tcp";
  regions?: Region[];
}) {
  const trpc = useTRPC();

  const { data: uptime, isLoading } = useQuery(
    trpc.tinybird.uptime.queryOptions({
      interval: 60 * 24,
      //   fromDate: startOfDay(subDays(new Date(), 7)).toISOString(), // FIXME:
      period: "7d",
      monitorId,
      regions,
      type,
    }),
  );

  if (isLoading) {
    return <Skeleton className=" my-auto h-5 w-full" />;
  }

  const refinedUptime = uptime ? mapUptime(uptime) : [];

  if (refinedUptime.length === 0) {
    return <span className="text-muted-foreground">-</span>;
  }

  return (
    <ChartContainer config={chartConfig} className="h-[28px] w-full">
      <BarChart accessibilityLayer data={refinedUptime} barCategoryGap={1}>
        <ChartTooltip
          cursor={false}
          allowEscapeViewBox={{ x: false, y: true }}
          wrapperStyle={{ zIndex: 1 }}
          content={<ChartTooltipContent indicator="dot" />}
        />
        <Bar dataKey="ok" stackId="a" fill="var(--color-ok)" />
        <Bar dataKey="error" stackId="a" fill="var(--color-error)" />
        <Bar dataKey="degraded" stackId="a" fill="var(--color-degraded)" />
        <XAxis
          dataKey="interval"
          tickLine={false}
          tickMargin={8}
          minTickGap={10}
          axisLine={false}
          hide
        />
      </BarChart>
    </ChartContainer>
  );
}
