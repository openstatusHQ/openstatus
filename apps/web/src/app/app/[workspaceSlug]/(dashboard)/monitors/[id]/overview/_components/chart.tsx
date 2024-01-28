"use client";

import type { CustomTooltipProps } from "@tremor/react";
import { Card, LineChart, Title } from "@tremor/react";

const dataFormatter = (number: number) =>
  `${Intl.NumberFormat("us").format(number).toString()}ms`;

interface ChartProps {
  data: { timestamp: string; [key: string]: string }[];
  regions: string[];
}

export function Chart({ data, regions }: ChartProps) {
  return (
    <Card>
      <Title>Response Time</Title>
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
          "indigo",
          "lime",
          "purple",
          "green",
          "orange",
          "sky",
          "rose",
          "violet",
          "teal",
          "fuchsia",
          "pink",
          "emerald",
        ]}
        onValueChange={(v) => void 0} // that prop makes the chart interactive
        valueFormatter={dataFormatter}
        curveType="monotone"
        intervalType="equidistantPreserveStart"
        // customTooltip={customTooltip}
      />
    </Card>
  );
}

// TBD: add custom tooltip
const customTooltip = ({ payload, active }: CustomTooltipProps) => {
  if (!active || !payload) return null;
  return (
    <div className="rounded-tremor-default text-tremor-default bg-tremor-background shadow-tremor-dropdown border-tremor-border w-36 border p-2">
      <div className="flex flex-col gap-3">
        {payload
          .filter((category) => category.type !== undefined) // tremor adds additional data to the payload, we don't want that
          .map((category, idx) => (
            <div key={idx} className="flex flex-1 gap-2">
              <div
                className={`flex w-1 flex-col bg-${category.color}-500 rounded`}
              />
              <div className="flex gap-1">
                <p className="text-tremor-content">{category.dataKey}</p>
                <p className="text-tremor-content-emphasis font-mono font-medium">
                  {dataFormatter(category.value as number)}
                </p>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
};
