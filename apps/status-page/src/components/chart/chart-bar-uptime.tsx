"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { formatNumber } from "@/lib/formatter";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Skeleton } from "../ui/skeleton";
import { ChartLegendBadge } from "./chart-legend-badge";

const chartConfig = {
  success: {
    label: "success",
    // WTF: why is var(--color-success) not working
    color: "var(--success)",
  },
  degraded: {
    label: "degraded",
    color: "var(--color-warning)",
  },
  error: {
    label: "failed",
    color: "var(--color-destructive)",
  },
} satisfies ChartConfig;

export function ChartBarUptime({
  className,
  data,
}: {
  className?: string;
  data: {
    timestamp: string;
    success: number;
    error: number;
    degraded: number;
  }[];
}) {
  const [activeSeries, setActiveSeries] = useState<
    Array<keyof typeof chartConfig>
  >(["success", "error", "degraded"]);

  const annotation = {
    success: formatNumber(data.reduce((acc, item) => acc + item.success, 0)),
    error: formatNumber(data.reduce((acc, item) => acc + item.error, 0)),
    degraded: formatNumber(data.reduce((acc, item) => acc + item.degraded, 0)),
  };

  return (
    <ChartContainer
      config={chartConfig}
      className={cn("h-[130px] w-full", className)}
    >
      <BarChart accessibilityLayer data={data} barCategoryGap={2}>
        <CartesianGrid vertical={false} />
        <ChartTooltip
          cursor={false}
          content={<ChartTooltipContent indicator="dot" />}
        />
        <Bar
          dataKey="success"
          fill="var(--color-success)"
          stackId="a"
          hide={!activeSeries.includes("success")}
        />
        <Bar
          dataKey="degraded"
          fill="var(--color-degraded)"
          stackId="a"
          hide={!activeSeries.includes("degraded")}
        />
        <Bar
          dataKey="error"
          fill="var(--color-error)"
          stackId="a"
          hide={!activeSeries.includes("error")}
        />
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
        <ChartLegend
          verticalAlign="top"
          content={
            <ChartLegendBadge
              active={activeSeries}
              handleActive={(item) => {
                setActiveSeries((prev) => {
                  if (item.dataKey) {
                    const key = item.dataKey as keyof typeof chartConfig;
                    if (prev.includes(key)) {
                      return prev.filter((item) => item !== key);
                    }
                    return [...prev, key];
                  }
                  return prev;
                });
              }}
              annotation={annotation}
              className="justify-start overflow-x-scroll ps-1 pt-1"
            />
          }
        />
      </BarChart>
    </ChartContainer>
  );
}

export function ChartBarUptimeSkeleton({ className }: { className?: string }) {
  return <Skeleton className={cn("h-[130px] w-full", className)} />;
}
