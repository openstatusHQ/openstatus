"use client";

import type { CustomTooltipProps } from "@tremor/react";
import { LineChart } from "@tremor/react";

import { cn } from "@/lib/utils";
import { nanoid } from "nanoid";
import { dataFormatter } from "./utils";

export interface SimpleChartProps {
  data: { timestamp: string; [key: string]: string }[];
  region: string;
}

// TODO: allow click to open `./details` intercepting route
export function SimpleChart({ data, region }: SimpleChartProps) {
  return (
    <LineChart
      data={data}
      index="timestamp"
      categories={[region]}
      colors={["green"]}
      className="h-20 w-full" // cannot take parent height
      valueFormatter={dataFormatter}
      curveType="monotone"
      autoMinValue
      showAnimation
      noDataText=""
      showXAxis={false}
      showYAxis={false}
      showGridLines={false}
      showLegend={false}
      customTooltip={customTooltip}
      // FEATURE: it would be nice, if on click, the tooltip would be open
      // onValueChange={(v) => setValue(v)}
    />
  );
}

const customTooltip = ({ payload, active, label }: CustomTooltipProps) => {
  if (!active || !payload) return null;
  const data = payload?.[0]; // BUG: when onValueChange is set, payload is duplicated
  if (!data) return null;

  return (
    <div className="rounded-tremor-default border border-tremor-border bg-tremor-background p-2 text-tremor-default shadow-tremor-dropdown dark:border-dark-tremor-border dark:bg-dark-tremor-background dark:text-dark-tremor-default">
      <div className="flex flex-col gap-3">
        {[data].map((category) => {
          return (
            <div
              key={`custom-tooltip-${nanoid(6)}`}
              className="flex flex-1 gap-2"
            >
              <div
                className={cn(
                  "flex w-1 flex-col rounded",
                  `bg-${category.color}-500`,
                )}
              />
              <div className="flex flex-col gap-1">
                <p className="text-tremor-content dark:text-dark-tremor-content">
                  {label}
                </p>
                <p className="font-medium font-mono text-tremor-content-emphasis dark:text-dark-tremor-content-emphasis">
                  {dataFormatter(category.value as number)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
