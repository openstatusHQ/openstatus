"use client";

import type { CustomTooltipProps, EventProps } from "@tremor/react";
import { LineChart } from "@tremor/react";
import { useState } from "react";

import type { Region } from "@openstatus/tinybird";

import { cn } from "@/lib/utils";
import { dataFormatter, regionFormatter } from "./utils";

interface ChartProps {
  data: { timestamp: string; [key: string]: string }[];
  regions: string[];
}

export function Chart({ data, regions }: ChartProps) {
  const [value, setValue] = useState<EventProps | null>(null);
  return (
    <LineChart
      data={data}
      yAxisWidth={64}
      index="timestamp"
      categories={regions}
      colors={[
        "blue",
        "amber",
        "cyan",
        "yellow",
        "red",
        "lime",
        "green",
        "purple",
        "indigo",
        "orange",
        "sky",
        "rose",
        "violet",
        "teal",
        "fuchsia",
        "pink",
        "emerald",
      ]}
      onValueChange={setValue}
      valueFormatter={dataFormatter}
      curveType="monotone"
      intervalType="equidistantPreserveStart"
      customTooltip={(props) => customTooltip({ ...props, value })}
      showAnimation={true}
    />
  );
}

const customTooltip = ({
  payload,
  active,
  label,
  value,
}: CustomTooltipProps & { value: EventProps }) => {
  if (!active || !payload) return null;
  return (
    <div className="rounded-tremor-default text-tremor-default dark:text-dark-tremor-default bg-tremor-background dark:bg-dark-tremor-background shadow-tremor-dropdown border-tremor-border dark:border-dark-tremor-border border p-2">
      <div className="flex flex-col gap-2">
        <p className="text-tremor-content dark:text-dark-tremor-content">
          {label}
        </p>
        {payload
          .filter((category) => category.type !== undefined) // tremor adds additional data to the payload, we don't want that
          .map((category, idx) => {
            const isActive = value
              ? value.categoryClicked === category.dataKey
              : true;
            return (
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: <explanation>
                key={idx}
                className={cn("flex flex-1 gap-2", !isActive && "opacity-60")}
              >
                <div
                  className={`flex w-1 flex-col bg-${category.color}-500 rounded`}
                />
                <div className="flex w-full justify-between gap-2">
                  <p className="text-tremor-content dark:text-dark-tremor-content shrink-0">
                    {regionFormatter(category.dataKey as Region)}
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
