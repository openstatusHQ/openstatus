"use client";

import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@openstatus/ui/components/ui/chart";
import { useIsMobile } from "@openstatus/ui/hooks/use-mobile";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import type { PingDay } from "@/data/heartbeat.client";
import { formatAxisTick, formatDate } from "@/lib/formatter";

const chartConfig = {
  ok: {
    label: "Success",
    color: "var(--color-success)",
  },
  error: {
    label: "Failed",
    color: "var(--color-destructive)",
  },
} satisfies ChartConfig;

const DAY_MINUTES = 1440;

/** Daily ping counts, the heartbeat sibling of `ChartBarUptime`. */
export function ChartBarPings({ data }: { data: PingDay[] }) {
  const isMobile = useIsMobile();

  return (
    <ChartContainer config={chartConfig} className="h-[130px] w-full">
      <BarChart
        accessibilityLayer
        data={data}
        barCategoryGap={isMobile ? 0 : 2}
      >
        <CartesianGrid vertical={false} />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              indicator="dot"
              labelFormatter={(_, payload) =>
                formatDate(new Date(payload[0]?.payload.day))
              }
            />
          }
        />
        <Bar dataKey="ok" stackId="a" fill="var(--color-ok)" />
        <Bar dataKey="error" stackId="a" fill="var(--color-error)" />
        <YAxis
          // a daily job tops out at 1: fill the height instead of a 0–4 scale
          domain={[0, "dataMax"]}
          allowDecimals={false}
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          orientation="right"
        />
        <XAxis
          dataKey="day"
          tickLine={false}
          tickMargin={8}
          minTickGap={10}
          axisLine={false}
          tickFormatter={(value) =>
            formatAxisTick(new Date(value), "30d", DAY_MINUTES)
          }
        />
        <ChartLegend content={<ChartLegendContent />} />
      </BarChart>
    </ChartContainer>
  );
}
