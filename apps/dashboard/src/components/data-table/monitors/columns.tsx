"use client";

import { TableCellLink } from "@/components/data-table/table-cell-link";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTableRowActions } from "./data-table-row-actions";

import { DataTableColumnHeader } from "@/components/ui/data-table/data-table-column-header";
import type { RouterOutputs } from "@openstatus/api";
import { formatDistanceToNow } from "date-fns";
import { TableCellSkeleton } from "../dable-cell-skeleton";
import { TableCellDate } from "../table-cell-date";
import { TableCellNumber } from "../table-cell-number";
import { TableCellUnavailable } from "../table-cell-unavailable";

type Monitor = RouterOutputs["monitor"]["list"][number] & {
  globalMetrics?:
    | RouterOutputs["tinybird"]["globalMetrics"]["data"][number]
    // NOTE: after loading the data, if the monitor has no metrics, the value will be `false`
    | false;
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
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Name" />
    ),
    cell: ({ row }) => {
      return (
        <TableCellLink
          value={row.getValue("name")}
          href={`/monitors/${row.original.id}/overview`}
        />
      );
    },
    enableHiding: false,
    meta: {
      cellClassName: "max-w-[150px] min-w-max",
    },
  },
  {
    accessorKey: "url",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Endpoint" />
    ),
    cell: ({ row }) => {
      return (
        <TableCellLink value={row.getValue("url")} href={row.original.url} />
      );
    },
    enableHiding: true,
    meta: {
      cellClassName: "max-w-[150px] min-w-max",
    },
  },
  {
    accessorKey: "jobType",
    header: "Type",
    enableHiding: true,
  },
  {
    id: "status",
    accessorFn: (row) => {
      console.log(row);
      return row.active ? row.status : "inactive";
    },
    header: "Status",
    cell: ({ row }) => {
      const value = String(row.getValue("status"));

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
    filterFn: (row, _, value) => {
      if (Array.isArray(value)) {
        if (value.includes("inactive")) {
          return !row.original.active;
        }
        if (value.includes("active")) {
          return !!row.original.active && row.original.status === "active";
        }
        return value.includes(row.original.status);
      }
      return row.original.status === value;
    },
    enableSorting: false,
    enableHiding: false,
    enableGlobalFilter: false,
  },
  {
    accessorKey: "active",
    enableHiding: true,
    enableGlobalFilter: false,
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
              className="relative flex translate-x-0 items-center gap-1.5 rounded-full bg-background transition-transform hover:z-10 hover:translate-x-1"
            >
              <div
                className="size-2.5 rounded-full"
                style={{ backgroundColor: tag.color }}
              />
              <span>{tag.name}</span>
            </Badge>
          ))}
        </div>
      );
    },
    filterFn: (row, _, value) => {
      const tagIds = row.original.tags.map((tag) => tag.id);
      if (Array.isArray(value)) {
        return value.some((v) => tagIds.includes(v));
      }
      return tagIds.includes(value);
    },
    getUniqueValues: (row) => row.tags.map((tag) => tag.id),
    enableSorting: false,
    enableHiding: false,
    enableGlobalFilter: false,
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
    enableGlobalFilter: false,
  },
  // {
  //   id: "uptime",
  //   accessorFn: (row) => `uptime-${row.id}`,
  //   header: "Last Week",
  //   cell: ({ row }) => {
  //     return (
  //       <ChartBarUptimeLight
  //         monitorId={String(row.original.id)}
  //         type={row.original.jobType as "http" | "tcp"}
  //       />
  //     );
  //   },
  //   enableHiding: false,
  //   enableGlobalFilter: false,
  // },
  {
    id: "lastTimestamp",
    header: "Last Checked",
    accessorFn: (row) =>
      typeof row.globalMetrics === "object"
        ? row.globalMetrics.lastTimestamp
        : row.globalMetrics,
    cell: ({ row }) => {
      const value = row.getValue("lastTimestamp");
      if (value === undefined) return <TableCellSkeleton className="w-full" />;
      return (
        <TableCellDate
          value={
            typeof value === "number"
              ? formatDistanceToNow(new Date(value), { addSuffix: true })
              : value
          }
        />
      );
    },
    enableHiding: false,
    enableGlobalFilter: false,
  },
  {
    id: "p50",
    accessorFn: (row) =>
      typeof row.globalMetrics === "object"
        ? row.globalMetrics.p50Latency
        : row.globalMetrics,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="P50" />
    ),
    cell: ({ row }) => {
      const value = row.getValue("p50");
      if (value === undefined) return <TableCellSkeleton />;
      if (!value) return <TableCellUnavailable />;
      return <TableCellNumber value={value} unit="ms" />;
    },
    enableHiding: false,
  },
  {
    id: "p90",
    accessorFn: (row) =>
      typeof row.globalMetrics === "object"
        ? row.globalMetrics.p90Latency
        : row.globalMetrics,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="P90" />
    ),
    cell: ({ row }) => {
      const value = row.getValue("p90");
      if (value === undefined) return <TableCellSkeleton />;
      if (!value) return <TableCellUnavailable />;
      return <TableCellNumber value={value} unit="ms" />;
    },
    enableHiding: false,
    enableGlobalFilter: false,
  },
  {
    id: "p95",
    accessorFn: (row) =>
      typeof row.globalMetrics === "object"
        ? row.globalMetrics.p95Latency
        : row.globalMetrics,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="P95" />
    ),
    cell: ({ row }) => {
      const value = row.getValue("p95");
      if (value === undefined) return <TableCellSkeleton />;
      if (!value) return <TableCellUnavailable />;
      return <TableCellNumber value={value} unit="ms" />;
    },
    enableHiding: false,
    enableGlobalFilter: false,
  },
  {
    id: "actions",
    cell: ({ row }) => <DataTableRowActions row={row} />,
    meta: {
      cellClassName: "w-8",
    },
  },
];
