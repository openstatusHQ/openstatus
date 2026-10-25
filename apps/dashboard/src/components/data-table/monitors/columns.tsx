"use client";

import type { RouterOutputs } from "@openstatus/api";
import { Badge } from "@openstatus/ui/components/ui/badge";
import { Checkbox } from "@openstatus/ui/components/ui/checkbox";
import type { ColumnDef } from "@tanstack/react-table";

import { TableCellLink } from "@/components/data-table/table-cell-link";
import { DataTableColumnHeader } from "@/components/ui/data-table/data-table-column-header";
import { formatDistanceToNowShort } from "@/lib/formatter";

import { TableCellSkeleton } from "../dable-cell-skeleton";
import { TableCellDate } from "../table-cell-date";
import { TableCellEmpty } from "../table-cell-empty";
import { TableCellIndicator } from "../table-cell-indicator";
import { TableCellNumber } from "../table-cell-number";
import { DataTableRowActions } from "./data-table-row-actions";

type Monitor = RouterOutputs["monitor"]["list"][number] & {
  globalMetrics?:
    | RouterOutputs["tinybird"]["globalMetrics"]["data"][number]
    // NOTE: after loading the data, if the monitor has no metrics, the value will be `false`
    | false;
};

export const columns: ColumnDef<Monitor>[] = [
  {
    id: "select",
    meta: { ghost: false },
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
    id: "status",
    accessorFn: (row) => (row.active ? row.status : "inactive"),
    header: () => <span className="sr-only">Status</span>,
    cell: ({ row }) => {
      const value = String(row.getValue("status"));

      switch (value) {
        case "active":
          return <TableCellIndicator variant="success" label={value} />;
        case "degraded":
          return <TableCellIndicator variant="warning" label={value} />;
        case "error":
          return <TableCellIndicator variant="destructive" label={value} />;
        default:
          return <TableCellIndicator variant="muted" label={value} />;
      }
    },
    filterFn: (row, _, value) => {
      const statuses: string[] = Array.isArray(value) ? value : [value];
      // "inactive" is a paused monitor, "active" a running healthy one;
      // every other status matches the monitor's status as-is
      return statuses.some((status) => {
        if (status === "inactive") return !row.original.active;
        if (status === "active") {
          return !!row.original.active && row.original.status === "active";
        }
        return row.original.status === status;
      });
    },
    enableSorting: false,
    enableHiding: false,
    enableGlobalFilter: false,
    meta: {
      headerClassName: "pr-0",
      cellClassName: "w-8 pr-0",
      ghost: false,
    },
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
          empty="No name"
          href={`/monitors/${row.original.id}/overview`}
        />
      );
    },
    enableHiding: false,
    meta: {
      cellClassName: "max-w-[200px] min-w-max",
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
        return <TableCellEmpty>No tags</TableCellEmpty>;
      }
      return (
        <div className="group/badges flex flex-wrap -space-x-2">
          {value.map((tag) => (
            <Badge
              key={tag.id}
              variant="outline"
              className="bg-background relative flex translate-x-0 items-center gap-1.5 rounded-full transition-transform hover:z-10 hover:translate-x-1"
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
    header: "Last Downtime",
    accessorFn: (row) => row.incidents?.[0]?.createdAt,
    cell: ({ row }) => {
      const value = row.getValue("lastIncident");
      return (
        <TableCellDate
          value={value}
          formatStr="LLL dd, y"
          empty="No downtime"
        />
      );
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
              ? formatDistanceToNowShort(new Date(value))
              : value
          }
          empty="Never"
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
      if (!value) return <TableCellEmpty>—</TableCellEmpty>;
      return <TableCellNumber value={value} unit="ms" />;
    },
    // fixed width: the skeleton is narrower than the values, so an auto width jumps on load
    meta: { headerClassName: "w-24" },
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
      if (!value) return <TableCellEmpty>—</TableCellEmpty>;
      return <TableCellNumber value={value} unit="ms" />;
    },
    meta: { headerClassName: "w-24" },
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
      if (!value) return <TableCellEmpty>—</TableCellEmpty>;
      return <TableCellNumber value={value} unit="ms" />;
    },
    meta: { headerClassName: "w-24" },
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
