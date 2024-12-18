"use client";

import { Line, LineChart, XAxis } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@openstatus/ui";

const chartConfig = {
  latency: {
    label: "Latency",
    color: "hsl(var(--status-operational))",
  },
};

export interface SimpleChartProps {
  data: { timestamp: string; latency: number | undefined }[];
}

// TODO: allow click to open `./details` intercepting route
export function SimpleChart({ data }: SimpleChartProps) {
  return (
    <ChartContainer config={chartConfig} className="h-20 w-full">
      <LineChart
        accessibilityLayer
        data={data}
        margin={{
          left: 12,
          right: 12,
        }}
      >
        <XAxis dataKey="timestamp" hide />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              indicator="dot"
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
                    className="w-1 h-full shrink-0 rounded-[2px] bg-[--color-bg] self-center"
                    style={
                      {
                        "--color-bg": `var(--color-${name})`,
                      } as React.CSSProperties
                    }
                  />
                  {chartConfig[name as keyof typeof chartConfig]?.label || name}
                  <div className="ml-auto flex items-baseline gap-0.5 font-mono font-medium tabular-nums text-foreground">
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
        <Line
          dataKey="latency"
          type="monotone"
          stroke="var(--color-latency)"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ChartContainer>
  );
}
