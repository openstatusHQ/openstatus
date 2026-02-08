"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  // XAxis,
  YAxis,
} from "recharts";

import { regions } from "@/data/regions";
import { formatMilliseconds } from "@/lib/formatter";
import type { MonitorRegion } from "@openstatus/db/src/schema";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartTooltip,
  ChartTooltipContent,
} from "@openstatus/ui/components/ui/chart";
import { Skeleton } from "@openstatus/ui/components/ui/skeleton";
import { cn } from "@openstatus/ui/lib/utils";
import { useState } from "react";
import { ChartLegendBadge } from "./chart-legend-badge";
import { ChartTooltipNumber } from "./chart-tooltip-number";

function avg(values: (number | null | string)[]) {
  const n = values.filter((val): val is number => typeof val === "number");
  return Math.round(n.reduce((acc, curr) => acc + curr, 0) / n.length);
}

function formatAnnotation(values: (number | null | string)[]) {
  if (values.length === 0) return "N/A";
  return formatMilliseconds(avg(values));
}

function getChartConfig(
  data: {
    timestamp: string;
    [key: string]: string | number | null;
  }[],
): ChartConfig {
  const regions =
    data.length > 0
      ? Object.keys(data[0]).filter((item) => item !== "timestamp")
      : [];

  return regions
    .sort((a, b) => {
      return (
        avg(data.map((item) => item[b])) - avg(data.map((item) => item[a]))
      );
    })
    .map((region, index) => ({
      code: region,
      color: `var(--rainbow-${((index + 5) % 17) + 1})`,
    }))
    .reduce(
      (acc, item) => {
        acc[item.code] = {
          label: item.code,
          color: item.color,
        };
        return acc;
      },
      {} as Record<string, { label: string; color: string }>,
    ) satisfies ChartConfig;
}

function getChartConfigDefault(regions: MonitorRegion[]) {
  return regions.reduce(
    (acc, region, index) => {
      acc[region] = {
        label: region,
        color: `var(--rainbow-${((index + 5) % 17) + 1})`,
      };
      return acc;
    },
    {} as Record<string, { label: string; color: string }>,
  ) satisfies ChartConfig;
}

export function ChartLineRegions({
  className,
  data,
  defaultRegions,
}: {
  className?: string;
  data: {
    timestamp: string;
    [key: string]: string | number | null;
  }[];
  defaultRegions?: MonitorRegion[];
}) {
  const chartConfig =
    data.length > 0
      ? getChartConfig(data)
      : getChartConfigDefault(defaultRegions ?? []);
  const [activeSeries, setActiveSeries] = useState<
    Array<keyof typeof chartConfig>
  >(Object.keys(chartConfig).slice(0, 2));

  const annotation = Object.keys(chartConfig).reduce(
    (acc, region) => {
      acc[region] = formatAnnotation(data.map((item) => item[region]));
      return acc;
    },
    {} as Record<string, string>,
  );

  const tooltip = regions.reduce(
    (acc, region) => {
      acc[region.code] = region.location;
      return acc;
    },
    {} as Record<string, string>,
  );

  return (
    <ChartContainer
      config={chartConfig}
      className={cn("h-[100px] w-full", className)}
    >
      <LineChart
        accessibilityLayer
        data={data}
        margin={{
          left: 0,
          right: 0,
          top: 2,
          bottom: 2,
        }}
      >
        <CartesianGrid vertical={false} />
        <XAxis dataKey="timestamp" />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              formatter={(value, name) => (
                <ChartTooltipNumber
                  chartConfig={chartConfig}
                  value={value}
                  name={name}
                  labelFormatter={(_, name) => {
                    const region = regions.find((r) => r.code === name);
                    return (
                      <>
                        <span className="font-mono">{name}</span>{" "}
                        <span className="text-muted-foreground text-xs">
                          {region?.location}
                        </span>
                      </>
                    );
                  }}
                />
              )}
            />
          }
        />
        {Object.keys(chartConfig).map((item) => (
          <Line
            key={item}
            dataKey={item}
            type="monotone"
            stroke={`var(--color-${item})`}
            dot={false}
            hide={!activeSeries.includes(item)}
            connectNulls
          />
        ))}
        <YAxis
          domain={["dataMin", "dataMax"]}
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          orientation="right"
          tickFormatter={(value) => `${value}ms`}
        />
        <ChartLegend
          verticalAlign="top"
          content={
            <ChartLegendBadge
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
              active={activeSeries}
              annotation={annotation}
              tooltip={tooltip}
              maxActive={6}
              className="justify-start overflow-x-scroll ps-1 pt-1 font-mono"
            />
          }
        />
      </LineChart>
    </ChartContainer>
  );
}

export function ChartLineRegionsSkeleton({
  className,
  ...props
}: React.ComponentProps<typeof Skeleton>) {
  return (
    <Skeleton
      className={cn("h-[100px] w-full rounded-lg", className)}
      {...props}
    />
  );
}
