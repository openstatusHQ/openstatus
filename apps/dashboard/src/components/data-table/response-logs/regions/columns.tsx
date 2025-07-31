"use client";

import { ChartLineRegion } from "@/components/chart/chart-line-region";
import { TableCellNumber } from "@/components/data-table/table-cell-number";
import { QuickActions } from "@/components/dropdowns/quick-actions";
import { DataTableColumnHeader } from "@/components/ui/data-table/data-table-column-header";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { RegionMetric } from "@/data/region-metrics";
import { getActions } from "@/data/region-metrics.client";
import { flyRegionsDict } from "@openstatus/utils";
import type { ColumnDef } from "@tanstack/react-table";
// import { toast } from "sonner";
import { useRouter } from "next/navigation";

function TrendCell({ trend }: { trend: RegionMetric["trend"] }) {
  return <ChartLineRegion className="h-[50px]" data={trend} />;
}

export const columns: ColumnDef<RegionMetric>[] = [
  {
    accessorKey: "region",
    header: "Region",
    cell: ({ row }) => {
      const value = row.getValue("region");
      if (typeof value === "string") {
        const region = flyRegionsDict[value as keyof typeof flyRegionsDict];
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger className="h-[50px]">
                {region.flag} {region.code}
              </TooltipTrigger>
              <TooltipContent side="left">{region.location}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      }
      return null;
    },
    enableSorting: false,
    enableHiding: false,
    meta: {
      cellClassName: "w-24 font-mono",
    },
  },
  {
    accessorKey: "trend",
    header: () => (
      <>
        Trend <span className="text-muted-foreground">(P50)</span>
      </>
    ),
    cell: ({ row }) => {
      return <TrendCell trend={row.original.trend} />;
    },
    enableSorting: false,
    enableHiding: false,
    meta: {
      cellClassName: "w-full min-w-[200px] max-w-full",
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
      // NOTE: works, but is not very react-esque
      // eslint-disable-next-line react-hooks/rules-of-hooks
      const router = useRouter();
      const actions = getActions({
        filter: async () => {
          router.push(`?regions=${row.original.region}`);
        },
        // TODO: add triggerById in TRPC client
        // trigger: async () => {
        //   console.log(row.original);
        //   const promise = new Promise((resolve) => setTimeout(resolve, 1000));
        //   toast.promise(promise, {
        //     loading: "Checking...",
        //     success: "Success",
        //     error: "Failed",
        //   });
        //   await promise;
        // },
      });
      return <QuickActions actions={actions} />;
    },
    meta: {
      headerClassName: "w-12",
      cellClassName: "text-right",
    },
  },
];
