"use client";

import { BarChart } from "@tremor/react";

import type { RegionCheck } from "../types";
import { valueFormatter } from "../utils";

export function MultiRegionChart({ regions }: { regions: RegionCheck[] }) {
  return (
    <BarChart
      data={regions}
      index="name"
      categories={["dns", "connection", "tls", "ttfb", "transfer"]}
      colors={["blue", "teal", "amber", "rose", "indigo", "emerald"]}
      valueFormatter={valueFormatter}
      stack
    />
  );
}
