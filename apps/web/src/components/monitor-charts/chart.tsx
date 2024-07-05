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
    <div className="rounded-tremor-default border border-tremor-border bg-tremor-background p-2 text-tremor-default shadow-tremor-dropdown dark:border-dark-tremor-border dark:bg-dark-tremor-background dark:text-dark-tremor-default">
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
                  className={cn(
                    "flex w-1 flex-col rounded",
                    `bg-${category.color}-500`
                  )}
                />
                <div className="flex w-full justify-between gap-2">
                  <p className="shrink-0 text-tremor-content dark:text-dark-tremor-content">
                    {regionFormatter(category.dataKey as Region)}
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
