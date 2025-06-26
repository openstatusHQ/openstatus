"use client";

import { TableCellLink } from "@/components/data-table/table-cell-link";
// import { TableCellNumber } from "@/components/data-table/table-cell-number";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
// import { DataTableColumnHeader } from "@/components/ui/data-table/data-table-column-header";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTableRowActions } from "./data-table-row-actions";

import type { RouterOutputs } from "@openstatus/api";
import { DataTableColumnHeader } from "@/components/ui/data-table/data-table-column-header";
import { TableCellNumber } from "../table-cell-number";
import { TableCellDate } from "../table-cell-date";
import { TableCellSkeleton } from "../dable-cell-skeleton";

type Monitor = RouterOutputs["monitor"]["list"][number] & {
  globalMetrics?: RouterOutputs["tinybird"]["globalMetrics"]["data"][number];
};

export const columns: ColumnDef<Monitor>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && "indeterminate")
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "name",
    header: "Name",
    cell: ({ row }) => {
      return (
        <TableCellLink
          value={row.getValue("name")}
          href={`/monitors/${row.original.id}/overview`}
        />
      );
    },
    enableSorting: false,
    enableHiding: false,
    meta: {
      cellClassName: "max-w-[150px] min-w-max",
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const value = String(row.getValue("status"));
      const active = Boolean(row.getValue("active"));

      if (!active) {
        return <div className="font-mono text-muted-foreground">inactive</div>;
      }

      switch (value) {
        case "active":
          return <div className="font-mono text-success">{value}</div>;
        case "degraded":
          return <div className="font-mono text-warning">{value}</div>;
        case "error":
          return <div className="font-mono text-destructive">{value}</div>;
        default:
          return <div className="font-mono text-muted-foreground">{value}</div>;
      }
    },
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "active",
    enableHiding: true,
  },
  {
    accessorKey: "tags",
    header: "Tags",
    cell: ({ row }) => {
      const value = row.getValue("tags");
      if (!Array.isArray(value)) return null;
      if (value.length === 0) {
        return <div className="text-muted-foreground">-</div>;
      }
      return (
        <div className="group/badges -space-x-2 flex flex-wrap">
          {value.map((tag) => (
            <Badge
              key={tag.id}
              variant="outline"
              className="relative flex translate-x-0 items-center gap-1.5 bg-background transition-transform hover:z-10 hover:translate-x-1 rounded-full"
            >
              <div
                className="size-2.5 rounded-full"
                style={{ backgroundColor: tag.color }}
              />
              {tag.name}
            </Badge>
          ))}
        </div>
      );
    },
    enableSorting: false,
    enableHiding: false,
  },
  {
    id: "lastIncident",
    header: "Last Incident",
    accessorFn: (row) => row.incidents?.[0]?.createdAt,
    cell: ({ row }) => {
      const value = row.getValue("lastIncident");
      return <TableCellDate value={value} formatStr="LLL dd, y" />;
    },
    enableHiding: false,
  },
  {
    id: "p50",
    accessorFn: (row) => row.globalMetrics?.p50Latency,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="P50" />
    ),
    cell: ({ row }) => {
      const value = row.getValue("p50");
      if (!value) {
        return <TableCellSkeleton />;
      }
      return <TableCellNumber value={value} unit="ms" />;
    },
    enableHiding: false,
  },
  {
    id: "p90",
    accessorFn: (row) => row.globalMetrics?.p90Latency,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="P90" />
    ),
    cell: ({ row }) => {
      const value = row.getValue("p90");
      if (!value) {
        return <TableCellSkeleton />;
      }
      return <TableCellNumber value={value} unit="ms" />;
    },
    enableHiding: false,
  },
  {
    id: "p95",
    accessorFn: (row) => row.globalMetrics?.p95Latency,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="P95" />
    ),
    cell: ({ row }) => {
      const value = row.getValue("p95");
      if (!value) {
        return <TableCellSkeleton />;
      }
      return <TableCellNumber value={value} unit="ms" />;
    },
    enableHiding: false,
  },
  // {
  //   id: "p99",
  //   accessorFn: (row) => row.globalMetrics?.p99Latency,
  //   header: ({ column }) => (
  //     <DataTableColumnHeader column={column} title="P99" />
  //   ),
  //   cell: ({ row }) => {
  //     const value = row.getValue("p99");
  //     if (!value) {
  //       return <TableCellSkeleton />;
  //     }
  //     return <TableCellNumber value={value} unit="ms" />;
  //   },
  //   enableHiding: false,
  // },
  {
    id: "actions",
    cell: ({ row }) => <DataTableRowActions row={row} />,
    meta: {
      cellClassName: "w-8",
    },
  },
];
