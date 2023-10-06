"use client";

import { Card, LineChart, Title } from "@tremor/react";

import type { Region } from "@openstatus/tinybird";

const dataFormatter = (number: number) =>
  `${Intl.NumberFormat("us")
    .format(number / 1000)
    .toString()}s`;

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
        index="timestamp"
        categories={regions}
        colors={[
          "blue",
          "red",
          "orange",
          "amber",
          "yellow",
          "lime",
          "green",
          "emerald",
          "teal",
          "cyan",
          "sky",
          "indigo",
          "violet",
          "purple",
          "fuchsia",
          "pink",
          "rose",
        ]}
        onValueChange={(v) => void 0} // make it interactive
        valueFormatter={dataFormatter}
        yAxisWidth={40}
      />
    </Card>
  );
}
