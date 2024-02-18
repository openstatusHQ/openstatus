"use client";

import type { CustomTooltipProps } from "@tremor/react";
import { LineChart } from "@tremor/react";

import { dataFormatter } from "./utils";

export interface SimpleChartProps {
  data: { timestamp: string; [key: string]: string }[];
  region: string;
}

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
      noDataText=""
      showXAxis={false}
      showYAxis={false}
      showGridLines={false}
      showLegend={false}
      customTooltip={customTooltip}
      showAnimation={true}
    />
  );
}

const customTooltip = ({ payload, active, label }: CustomTooltipProps) => {
  if (!active || !payload) return null;
  return (
    <div className="rounded-tremor-default text-tremor-default dark:text-dark-tremor-default bg-tremor-background dark:bg-dark-tremor-background shadow-tremor-dropdown border-tremor-border dark:border-dark-tremor-border border p-2">
      <div className="flex flex-col gap-3">
        {payload.map((category, idx) => {
          return (
            <div key={idx} className="flex flex-1 gap-2">
              <div
                className={`flex w-1 flex-col bg-${category.color}-500 rounded`}
              />
              <div className="flex flex-col gap-1">
                <p className="text-tremor-content dark:text-dark-tremor-content">
                  {label}
                </p>
                <p className="text-tremor-content-emphasis dark:text-dark-tremor-content-emphasis font-mono font-medium">
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
