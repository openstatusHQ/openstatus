"use client";

import { SimpleChart } from "@/components/monitor-charts/simple-chart";
import { formatNumber } from "@/components/monitor-dashboard/metrics-card";
import type { ResponseTimeMetricsByRegion } from "@/lib/tb";
import type { Region } from "@openstatus/db/src/schema/constants";
import { flyRegionsDict } from "@openstatus/utils";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTableColumnHeader } from "./data-table-column-header";

export interface RegionWithMetrics {
  data: (Partial<Record<Region, number>> & { timestamp: string })[];
  metrics?: ResponseTimeMetricsByRegion;
  region: Region;
}

export const columns: ColumnDef<RegionWithMetrics>[] = [
  {
    accessorKey: "region",
    header: "Region",
    cell: ({ row }) => {
      const region = row.getValue("region") as Region;
      const { code, flag, location } = flyRegionsDict[region];
      return (
        <div>
          <p className="text-muted-foreground text-xs">{location}</p>
          <p className="font-mono text-xs">
            {flag} {code}
          </p>
        </div>
      );
    },
    meta: {
      headerClassName: "w-[100px]",
    },
  },
  {
    accessorKey: "data",
    header: "Trend",
    cell: ({ row }) => {
      const data = row.getValue("data") as RegionWithMetrics["data"];
      const region = row.getValue("region") as Region;
      return (
        <SimpleChart
          data={data.map((d) => ({
            timestamp: d.timestamp,
            latency: d[region],
          }))}
        />
      );
    },
    meta: {
      headerClassName: "min-w-[300px] w-full",
    },
  },
  {
    accessorKey: "p50",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="P50" />
    ),
    accessorFn: (row) => row.metrics?.p50Latency,
    cell: ({ row }) => {
      const p50 = row.getValue("p50") as number;
      return (
        <div className="whitespace-nowrap font-mono">
          <span>{formatNumber(p50)}</span>
          <span className="text-muted-foreground text-xs">ms</span>
        </div>
      );
    },
  },
  {
    accessorKey: "p95",
    accessorFn: (row) => row.metrics?.p95Latency,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="P95" />
    ),
    cell: ({ row }) => {
      const p95 = row.getValue("p95") as number;
      return (
        <div className="whitespace-nowrap font-mono">
          <span>{formatNumber(p95)}</span>
          <span className="text-muted-foreground text-xs">ms</span>
        </div>
      );
    },
  },
  {
    accessorKey: "p99",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="P99" />
    ),
    accessorFn: (row) => row.metrics?.p99Latency,
    cell: ({ row }) => {
      const p99 = row.getValue("p99") as number;
      return (
        <div className="whitespace-nowrap font-mono">
          <span>{formatNumber(p99)}</span>
          <span className="text-muted-foreground text-xs">ms</span>
        </div>
      );
    },
  },
];
