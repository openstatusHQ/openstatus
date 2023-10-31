"use client";

import { Card, LineChart, Title } from "@tremor/react";

import type { Region } from "@openstatus/tinybird";

const dataFormatter = (number: number) =>
  `${Intl.NumberFormat("us").format(number).toString()}ms`;

interface ChartProps {
  data: (Partial<Record<Region, string>> & { timestamp: string })[];
  regions: Region[];
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
      />
    </Card>
  );
}
