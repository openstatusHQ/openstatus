"use client";

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

import { getRegionColor } from "@/data/regions";
import { cn } from "@/lib/utils";
import type { PrivateLocation } from "@openstatus/db/src/schema";
import { monitorRegions } from "@openstatus/db/src/schema/constants";
import { getRegionInfo } from "@openstatus/regions";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@openstatus/ui/components/ui/chart";
import { useIsMobile } from "@openstatus/ui/hooks/use-mobile";
import { ChartTooltipNumber } from "./chart-tooltip-number";

function getChartConfig(privateLocations?: PrivateLocation[]) {
  return [
    ...monitorRegions,
    ...(privateLocations?.map((location) => location.id.toString()) ?? []),
  ].reduce((config, region) => {
    const privateLocation = privateLocations?.find(
      (location) => String(location.id) === String(region),
    );
    const regionInfo = getRegionInfo(region, {
      location: privateLocation?.name,
    });
    const color = getRegionColor(region);

    if (regionInfo && color) {
      config[region] = {
        label: `${regionInfo.location} (${regionInfo.provider})`,
        color,
      };
    }

    return config;
  }, {} as ChartConfig) satisfies ChartConfig;
}

export type TrendPoint = {
  timestamp: number; // unix millis
  [key: string]: number; // milliseconds
};

export function ChartLineRegions({
  className,
  data,
  regions,
  privateLocations,
}: {
  className?: string;
  data: TrendPoint[];
  regions: string[] | undefined;
  privateLocations?: PrivateLocation[];
}) {
  const isMobile = useIsMobile();
  const trendData = data ?? [];
  const chartConfig = getChartConfig(privateLocations);
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
        {regions?.map((region) => {
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
        {regions && regions.length <= 6 && !isMobile ? (
          <ChartLegend
            className="flex-wrap"
            content={<ChartLegendContent className="text-nowrap" />}
          />
        ) : null}
      </LineChart>
    </ChartContainer>
  );
}
