"use client";

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { regionColors } from "@/data/regions";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { monitorRegions } from "@openstatus/db/src/schema/constants";
import { regionDict } from "@openstatus/regions";
import { ChartTooltipNumber } from "./chart-tooltip-number";

const chartConfig = monitorRegions.reduce((config, region) => {
  const regionInfo = regionDict[region as keyof typeof regionDict];
  const color = regionColors[region as keyof typeof regionColors];

  if (regionInfo && color) {
    config[region] = {
      label: `${regionInfo.location} (${regionInfo.provider})`,
      color,
    };
  }

  return config;
}, {} as ChartConfig) satisfies ChartConfig;

export type TrendPoint = {
  timestamp: number; // unix millis
  [key: string]: number; // milliseconds
};

export function ChartLineRegions({
  className,
  data,
  regions,
}: {
  className?: string;
  data: TrendPoint[];
  regions: string[];
}) {
  const isMobile = useIsMobile();
  const trendData = data ?? [];

  const chartData = trendData.map((d) => ({
    ...d,
    timestamp: new Date(d.timestamp).toLocaleString("default", {
      hour: "numeric",
      minute: "numeric",
      day: "numeric",
      month: "short",
    }),
  }));

  return (
    <ChartContainer
      config={chartConfig}
      className={cn("h-[250px] w-full", className)}
    >
      <LineChart
        accessibilityLayer
        data={chartData}
        margin={{
          left: 12,
          right: 12,
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
                />
              )}
            />
          }
        />
        {regions.map((region) => {
          return (
            <Line
              key={region}
              dataKey={region}
              type="monotone"
              stroke={`var(--color-${region})`}
              strokeWidth={2}
              dot={false}
            />
          );
        })}
        <YAxis
          domain={["dataMin", "dataMax"]}
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          orientation="right"
          tickFormatter={(value) => `${value}ms`}
        />
        {regions.length <= 6 && !isMobile ? (
          <ChartLegend
            className="flex-wrap"
            content={<ChartLegendContent className="text-nowrap" />}
          />
        ) : null}
      </LineChart>
    </ChartContainer>
  );
}
