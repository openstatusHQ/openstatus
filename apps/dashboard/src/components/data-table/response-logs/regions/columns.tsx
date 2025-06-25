"use client";

import { ChartLineRegion } from "@/components/chart/chart-line-region";
import { TableCellNumber } from "@/components/data-table/table-cell-number";
import { QuickActions } from "@/components/dropdowns/quick-actions";
import { DataTableColumnHeader } from "@/components/ui/data-table/data-table-column-header";
import type { RegionMetric } from "@/data/region-metrics";
import { getActions } from "@/data/region-metrics.client";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";

function TrendCell({ trend }: { trend: RegionMetric["trend"] }) {
  return <ChartLineRegion className="h-[50px]" data={trend} />;
}

export const columns: ColumnDef<RegionMetric>[] = [
  {
    accessorKey: "region",
    header: "Region",
    enableSorting: false,
    enableHiding: false,
    meta: {
      cellClassName: "w-24",
    },
  },
  {
    accessorKey: "trend",
    header: "Trend",
    cell: ({ row }) => {
      return <TrendCell trend={row.original.trend} />;
    },
    enableSorting: false,
    enableHiding: false,
    meta: {
      cellClassName: "w-full",
    },
  },
  {
    accessorKey: "p50",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="P50" />
    ),
    cell: ({ row }) => {
      return <TableCellNumber value={row.getValue("p50")} unit="ms" />;
    },
    enableHiding: false,
    meta: {
      cellClassName: "w-12",
    },
  },
  {
    accessorKey: "p90",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="P90" />
    ),
    cell: ({ row }) => {
      return <TableCellNumber value={row.getValue("p90")} unit="ms" />;
    },
    enableHiding: false,
    meta: {
      cellClassName: "w-12",
    },
  },
  {
    accessorKey: "p99",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="P99" />
    ),
    cell: ({ row }) => {
      return <TableCellNumber value={row.getValue("p99")} unit="ms" />;
    },
    enableHiding: false,
    meta: {
      cellClassName: "w-12",
    },
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const actions = getActions({
        trigger: async () => {
          console.log(row.original);
          const promise = new Promise((resolve) => setTimeout(resolve, 1000));
          toast.promise(promise, {
            loading: "Checking...",
            success: "Success",
            error: "Failed",
          });
          await promise;
        },
      });
      return <QuickActions actions={actions} />;
    },
    meta: {
      headerClassName: "w-12",
      cellClassName: "text-right",
    },
  },
];
