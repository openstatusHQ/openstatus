"use client";

import type { RegionChecker } from "./utils";
import { getTimingPhases, regionFormatter } from "./utils";

import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";

import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@openstatus/ui/src/components/chart";

const chartConfig = {
  dns: {
    label: "DNS",
    color: "hsl(var(--chart-1))",
  },
  connection: {
    label: "Connection",
    color: "hsl(var(--chart-2))",
  },
  tls: {
    label: "TLS",
    color: "hsl(var(--chart-3))",
  },
  ttfb: {
    label: "TTFB",
    color: "hsl(var(--chart-4))",
  },
  transfer: {
    label: "Transfer",
    color: "hsl(var(--chart-5))",
  },
} satisfies ChartConfig;

export function MultiRegionChart({ regions }: { regions: RegionChecker[] }) {
  const chartData = regions
    .sort((a, b) => a.latency - b.latency) // FIXME: seems to be off
    .map((item) => {
      const { dns, connection, tls, ttfb, transfer } = getTimingPhases(
        item.timing,
      );
      return {
        region: item.region,
        dns,
        connection,
        tls,
        ttfb,
        transfer,
      };
    });
  return (
    <div className="relative">
      <ChartContainer config={chartConfig}>
        <BarChart accessibilityLayer data={chartData}>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="region"
            tickLine={false}
            tickMargin={10}
            axisLine={false}
            interval={0}
            tick={(props) => {
              const { x, y, payload } = props;
              return (
                <g transform={`translate(${x},${y})`}>
                  <text
                    x={0}
                    y={0}
                    dy={2}
                    textAnchor="end"
                    fill="#666"
                    transform="rotate(-35)"
                    className="font-mono"
                  >
                    {payload.value}
                  </text>
                </g>
              );
            }}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                labelFormatter={(label) => regionFormatter(label, "long")}
              />
            }
          />
          <ChartLegend content={<ChartLegendContent />} />
          <Bar dataKey="dns" stackId="a" fill="var(--color-dns)" />
          <Bar
            dataKey="connection"
            stackId="a"
            fill="var(--color-connection)"
          />
          <Bar dataKey="tls" stackId="a" fill="var(--color-tls)" />
          <Bar dataKey="ttfb" stackId="a" fill="var(--color-ttfb)" />
          <Bar dataKey="transfer" stackId="a" fill="var(--color-transfer)" />
        </BarChart>
      </ChartContainer>
      {regions.length ? null : (
        <div className="absolute inset-0 flex w-full items-center justify-center bg-muted/50">
          <div className="text-foreground">No results</div>
        </div>
      )}
    </div>
  );
}
