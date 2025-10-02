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
import { regionDict } from "@openstatus/utils";
import { ChartTooltipNumber } from "./chart-tooltip-number";

const chartConfig = {
  ams: { label: regionDict.ams.location, color: regionColors.ams },
  arn: { label: regionDict.arn.location, color: regionColors.arn },
  atl: { label: regionDict.atl.location, color: regionColors.atl },
  bog: { label: regionDict.bog.location, color: regionColors.bog },
  bom: { label: regionDict.bom.location, color: regionColors.bom },
  bos: { label: regionDict.bos.location, color: regionColors.bos },
  cdg: { label: regionDict.cdg.location, color: regionColors.cdg },
  den: { label: regionDict.den.location, color: regionColors.den },
  dfw: { label: regionDict.dfw.location, color: regionColors.dfw },
  ewr: { label: regionDict.ewr.location, color: regionColors.ewr },
  eze: { label: regionDict.eze.location, color: regionColors.eze },
  fra: { label: regionDict.fra.location, color: regionColors.fra },
  gdl: { label: regionDict.gdl.location, color: regionColors.gdl },
  gig: { label: regionDict.gig.location, color: regionColors.gig },
  gru: { label: regionDict.gru.location, color: regionColors.gru },
  hkg: { label: regionDict.hkg.location, color: regionColors.hkg },
  iad: { label: regionDict.iad.location, color: regionColors.iad },
  jnb: { label: regionDict.jnb.location, color: regionColors.jnb },
  lax: { label: regionDict.lax.location, color: regionColors.lax },
  lhr: { label: regionDict.lhr.location, color: regionColors.lhr },
  mad: { label: regionDict.mad.location, color: regionColors.mad },
  mia: { label: regionDict.mia.location, color: regionColors.mia },
  nrt: { label: regionDict.nrt.location, color: regionColors.nrt },
  ord: { label: regionDict.ord.location, color: regionColors.ord },
  otp: { label: regionDict.otp.location, color: regionColors.otp },
  phx: { label: regionDict.phx.location, color: regionColors.phx },
  qro: { label: regionDict.qro.location, color: regionColors.qro },
  scl: { label: regionDict.scl.location, color: regionColors.scl },
  sjc: { label: regionDict.sjc.location, color: regionColors.sjc },
  sea: { label: regionDict.sea.location, color: regionColors.sea },
  sin: { label: regionDict.sin.location, color: regionColors.sin },
  syd: { label: regionDict.syd.location, color: regionColors.syd },
  waw: { label: regionDict.waw.location, color: regionColors.waw },
  yul: { label: regionDict.yul.location, color: regionColors.yul },
  yyz: { label: regionDict.yyz.location, color: regionColors.yyz },
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
  const isMobile = useIsMobile();
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
