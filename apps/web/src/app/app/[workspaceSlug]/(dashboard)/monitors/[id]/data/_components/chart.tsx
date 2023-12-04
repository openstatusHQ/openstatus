"use client";

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
      />
    </Card>
  );
}
