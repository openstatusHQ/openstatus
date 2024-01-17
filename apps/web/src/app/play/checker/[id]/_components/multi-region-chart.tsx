"use client";

import { BarChart } from "@tremor/react";

import type { RegionChecker } from "../utils";
import { getTimingPhases, regionFormatter, valueFormatter } from "../utils";

export function MultiRegionChart({ regions }: { regions: RegionChecker[] }) {
  const data = regions.map((item) => {
    const { dns, connection, tls, ttfb, transfer } = getTimingPhases(
      item.timing,
    );
    return {
      region: regionFormatter(item.region),
      dns,
      connection,
      tls,
      ttfb,
      transfer,
    };
  });
  return (
    <BarChart
      data={data}
      index="region"
      categories={["dns", "connection", "tls", "ttfb", "transfer"]}
      colors={["blue", "teal", "amber", "slate", "indigo"]}
      valueFormatter={valueFormatter}
      stack
      layout="vertical"
      yAxisWidth={65}
    />
  );
}
