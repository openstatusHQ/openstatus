"use client";

import type { Region } from "@openstatus/db/src/schema/constants";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@openstatus/ui";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { regionFormatter } from "./utils";

interface ChartProps {
  data: { timestamp: string; [key: string]: string | number }[];
  regions: string[];
}

export function Chart({ data, regions }: ChartProps) {
  return (
    <ChartContainer config={chartConfig}>
      <LineChart
        accessibilityLayer
        data={data}
        margin={{
          left: 12,
          right: 12,
        }}
      >
        <ChartLegend
          content={<ChartLegendContent className="flex-wrap" />}
          verticalAlign="top"
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          scale="sqrt"
          domain={([dataMin, dataMax]) => {
            const min = Math.max(Math.abs(dataMin) - 25, 0);
            const max = dataMax + 100;
            return [min, max];
          }}
        />
        <XAxis
          dataKey="timestamp"
          tickLine={false}
          tickFormatter={(value) => {
            return new Date(value).toLocaleDateString("en-US", {
              day: "numeric",
              month: "short",
              hour: "numeric",
              minute: "numeric",
            });
          }}
        />
        <CartesianGrid vertical={false} />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              indicator="line"
              labelFormatter={(value) => {
                return new Date(value).toLocaleDateString("en-US", {
                  day: "numeric",
                  month: "short",
                  hour: "numeric",
                  minute: "numeric",
                });
              }}
              formatter={(value, name) => (
                <>
                  <div
                    className="h-full w-1 shrink-0 self-center rounded-[2px] bg-[--color-bg]"
                    style={
                      {
                        "--color-bg": `var(--color-${name})`,
                      } as React.CSSProperties
                    }
                  />
                  {/* {chartConfig[name as keyof typeof chartConfig]?.label || name} */}
                  {regionFormatter(name as Region)}
                  <div className="ml-auto flex items-baseline gap-0.5 font-medium font-mono text-foreground tabular-nums">
                    {value}
                    <span className="font-normal text-muted-foreground">
                      ms
                    </span>
                  </div>
                </>
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
      </LineChart>
    </ChartContainer>
  );
}

// basic tailwindcss 500 colors in hsl format
const chartConfig: Record<Region, { label: string; color: string }> = {
  ams: { label: "AMS", color: "hsl(217.2 91.2% 59.8%)" },
  arn: { label: "ARN", color: "hsl(238.7 83.5% 66.7%)" },
  atl: { label: "ATL", color: "hsl(258.3 89.5% 66.3%)" },
  bog: { label: "BOG", color: "hsl(270.7 91% 65.1%)" },
  bom: { label: "BOM", color: "hsl(292.2 84.1% 60.6%)" },
  bos: { label: "BOS", color: "hsl(330.4 81.2% 60.4%)" },
  cdg: { label: "CDG", color: "hsl(349.7 89.2% 60.2%)" },
  den: { label: "DEN", color: "hsl(215.4 16.3% 46.9%)" },
  dfw: { label: "DFW", color: "hsl(220 8.9% 46.1%)" },
  ewr: { label: "EWR", color: "hsl(240 3.8% 46.1%)" },
  eze: { label: "EZE", color: "hsl(0 0% 45.1%)" },
  fra: { label: "FRA", color: "hsl(25 5.3% 44.7%)" },
  gdl: { label: "GDL", color: "hsl(0 84.2% 60.2%)" },
  gig: { label: "GIG", color: "hsl(24.6 95% 53.1%)" },
  gru: { label: "GRU", color: "hsl(37.7 92.1% 50.2%)" },
  hkg: { label: "HKG", color: "hsl(45.4 93.4% 47.5%)" },
  iad: { label: "IAD", color: "hsl(83.7 80.5% 44.3%)" },
  jnb: { label: "JNB", color: "hsl(142.1 70.6% 45.3%)" },
  lax: { label: "LAX", color: "hsl(160.1 84.1% 39.4%)" },
  lhr: { label: "LHR", color: "hsl(173.4 80.4% 40%)" },
  mad: { label: "MAD", color: "hsl(188.7 94.5% 42.7%)" },
  mia: { label: "MIA", color: "hsl(198.6 88.7% 48.4%)" },
  nrt: { label: "NRT", color: "hsl(217.2 91.2% 59.8%)" },
  ord: { label: "ORD", color: "hsl(238.7 83.5% 66.7%)" },
  otp: { label: "OTP", color: "hsl(258.3 89.5% 66.3%)" },
  phx: { label: "PHX", color: "hsl(270.7 91% 65.1%)" },
  qro: { label: "QRO", color: "hsl(292.2 84.1% 60.6%)" },
  scl: { label: "SCL", color: "hsl(330.4 81.2% 60.4%)" },
  sjc: { label: "SJC", color: "hsl(349.7 89.2% 60.2%)" },
  sea: { label: "SEA", color: "hsl(215.4 16.3% 46.9%)" },
  sin: { label: "SIN", color: "hsl(220 8.9% 46.1%)" },
  syd: { label: "SYD", color: "hsl(240 3.8% 46.1%)" },
  waw: { label: "WAW", color: "hsl(0 0% 45.1%)" },
  yul: { label: "YUL", color: "hsl(25 5.3% 44.7%)" },
  yyz: { label: "YYZ", color: "hsl(0 84.2% 60.2%)" },
};
