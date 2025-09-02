"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  // XAxis,
  YAxis,
} from "recharts";

import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { regions } from "@/data/regions";
import { formatMilliseconds } from "@/lib/formatter";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { ChartLegendBadge } from "./chart-legend-badge";
import { ChartTooltipNumber } from "./chart-tooltip-number";

const r = regions.filter((r) =>
  ["ams", "bog", "arn", "atl", "bom", "syd", "fra"].includes(r.code),
);

const randomizer = Math.random() * 50;

const chartData = Array.from({ length: 30 }, (_, i) => ({
  timestamp: new Date(
    new Date().setMinutes(new Date().getMinutes() - i),
  ).toLocaleString("default", {
    hour: "numeric",
    minute: "numeric",
  }),
  ams: Math.floor(Math.random() * randomizer) * 100 * 0.75,
  bog: Math.floor(Math.random() * randomizer) * 100 * 0.75,
  arn: Math.floor(Math.random() * randomizer) * 100 * 0.75,
  atl: Math.floor(Math.random() * randomizer) * 100 * 0.75,
  bom: Math.floor(Math.random() * randomizer) * 100 * 0.75,
  syd: Math.floor(Math.random() * randomizer) * 100 * 0.75,
  fra: Math.floor(Math.random() * randomizer) * 100 * 0.75,
}));

const s = r.sort((a, b) => {
  const aAvg = avg(
    chartData.map((d) => {
      const value = d[a.code as keyof typeof d];
      if (typeof value === "number") {
        return value;
      }
      return 0;
    }),
  );
  const bAvg = avg(
    chartData.map((d) => {
      const value = d[b.code as keyof typeof d];
      if (typeof value === "number") {
        return value;
      }
      return 0;
    }),
  );
  return bAvg - aAvg;
});

const chartConfig = s
  .map((item, index) => ({
    code: item.code,
    label: item.code,
    color: `var(--rainbow-${index + 1})`,
  }))
  .reduce(
    (acc, item) => {
      acc[item.code] = item;
      return acc;
    },
    {} as Record<string, { label: string; color: string }>,
  ) satisfies ChartConfig;

function avg(values: number[]) {
  return Math.round(
    values.reduce((acc, curr) => acc + curr, 0) / values.length,
  );
}

const annotation = r.reduce(
  (acc, item) => {
    acc[item.code] = formatMilliseconds(
      avg(
        chartData.map((d) => {
          const value = d[item.code as keyof typeof d];
          if (typeof value === "number") {
            return value;
          }
          return 0;
        }),
      ),
    );
    return acc;
  },
  {} as Record<string, string>,
);

const tooltip = r.reduce(
  (acc, item) => {
    acc[item.code] = item.location;
    return acc;
  },
  {} as Record<string, string>,
);

export function ChartLineRegions({ className }: { className?: string }) {
  const [activeSeries, setActiveSeries] = useState<
    Array<keyof typeof chartConfig>
  >([s[0].code, s[1].code]);
  return (
    <ChartContainer
      config={chartConfig}
      className={cn("h-[100px] w-full", className)}
    >
      <LineChart
        accessibilityLayer
        data={chartData}
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
        {r.map((item) => (
          <Line
            key={item.code}
            dataKey={item.code}
            type="monotone"
            stroke={`var(--color-${item.code})`}
            dot={false}
            hide={!activeSeries.includes(item.code)}
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
              maxActive={3}
              annotation={annotation}
              tooltip={tooltip}
              className="justify-start overflow-x-scroll ps-1 pt-1 font-mono"
            />
          }
        />
      </LineChart>
    </ChartContainer>
  );
}
