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
import { cn } from "@/lib/utils";
import { flyRegionsDict } from "@openstatus/utils";
import { ChartTooltipNumber } from "./chart-tooltip-number";

const chartConfig = {
  ams: { label: flyRegionsDict.ams.location, color: regionColors.ams },
  arn: { label: flyRegionsDict.arn.location, color: regionColors.arn },
  atl: { label: flyRegionsDict.atl.location, color: regionColors.atl },
  bog: { label: flyRegionsDict.bog.location, color: regionColors.bog },
  bom: { label: flyRegionsDict.bom.location, color: regionColors.bom },
  bos: { label: flyRegionsDict.bos.location, color: regionColors.bos },
  cdg: { label: flyRegionsDict.cdg.location, color: regionColors.cdg },
  den: { label: flyRegionsDict.den.location, color: regionColors.den },
  dfw: { label: flyRegionsDict.dfw.location, color: regionColors.dfw },
  ewr: { label: flyRegionsDict.ewr.location, color: regionColors.ewr },
  eze: { label: flyRegionsDict.eze.location, color: regionColors.eze },
  fra: { label: flyRegionsDict.fra.location, color: regionColors.fra },
  gdl: { label: flyRegionsDict.gdl.location, color: regionColors.gdl },
  gig: { label: flyRegionsDict.gig.location, color: regionColors.gig },
  gru: { label: flyRegionsDict.gru.location, color: regionColors.gru },
  hkg: { label: flyRegionsDict.hkg.location, color: regionColors.hkg },
  iad: { label: flyRegionsDict.iad.location, color: regionColors.iad },
  jnb: { label: flyRegionsDict.jnb.location, color: regionColors.jnb },
  lax: { label: flyRegionsDict.lax.location, color: regionColors.lax },
  lhr: { label: flyRegionsDict.lhr.location, color: regionColors.lhr },
  mad: { label: flyRegionsDict.mad.location, color: regionColors.mad },
  mia: { label: flyRegionsDict.mia.location, color: regionColors.mia },
  nrt: { label: flyRegionsDict.nrt.location, color: regionColors.nrt },
  ord: { label: flyRegionsDict.ord.location, color: regionColors.ord },
  otp: { label: flyRegionsDict.otp.location, color: regionColors.otp },
  phx: { label: flyRegionsDict.phx.location, color: regionColors.phx },
  qro: { label: flyRegionsDict.qro.location, color: regionColors.qro },
  scl: { label: flyRegionsDict.scl.location, color: regionColors.scl },
  sjc: { label: flyRegionsDict.sjc.location, color: regionColors.sjc },
  sea: { label: flyRegionsDict.sea.location, color: regionColors.sea },
  sin: { label: flyRegionsDict.sin.location, color: regionColors.sin },
  syd: { label: flyRegionsDict.syd.location, color: regionColors.syd },
  waw: { label: flyRegionsDict.waw.location, color: regionColors.waw },
  yul: { label: flyRegionsDict.yul.location, color: regionColors.yul },
  yyz: { label: flyRegionsDict.yyz.location, color: regionColors.yyz },
} satisfies ChartConfig;

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
  const trendData = data ?? [];

  console.log({ data, regions });

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
        <ChartLegend
          className="flex-wrap"
          content={<ChartLegendContent className="text-nowrap" />}
        />
      </LineChart>
    </ChartContainer>
  );
}
