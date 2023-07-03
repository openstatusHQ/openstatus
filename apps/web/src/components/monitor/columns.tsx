"use client";

import type { ColumnDef } from "@tanstack/react-table";

import type { Ping } from "@openstatus/tinybird";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { DataTableColumnHeader } from "./data-table-column-header";
import { DataTableRowActions } from "./data-table-row-action";

export const columns: ColumnDef<Ping>[] = [
  {
    accessorKey: "timestamp",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Date" />
    ),
    cell: ({ row }) => {
      return (
        <div>
          {new Intl.DateTimeFormat("en", {
            year: "numeric",
            month: "numeric",
            day: "numeric",
            hour: "numeric",
            minute: "numeric",
            hour12: false, // dismiss hydration issue ("_PM" and "__PM")
          }).format(row.getValue("timestamp"))}
        </div>
      );
    },
  },
  {
    accessorKey: "statusCode",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" />
    ),
    cell: ({ row }) => {
      const statusCode = String(row.getValue("statusCode"));
      const isOk = statusCode.startsWith("2");
      return (
        <Badge
          variant="outline"
          className={cn(
            "px-2 py-0.5 text-xs",
            isOk ? "border-green-100 bg-green-50" : "border-red-100 bg-red-50",
          )}
        >
          {statusCode}
          <div
            className={cn(
              "bg-foreground ml-1 h-1.5 w-1.5 rounded-full",
              isOk ? "bg-green-500" : "bg-red-500",
            )}
          />
        </Badge>
      );
    },
    filterFn: (row, id, value) => {
      // needed because value is number, not string
      return `${row.getValue(id)}`.includes(`${value}`);
    },
  },
  {
    accessorKey: "latency",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Latency" />
    ),
  },
  {
    accessorKey: "region",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Region" />
    ),
  },
  {
    accessorKey: "url",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="URL" />
    ),
    cell: ({ row }) => {
      const url = new URL(row.getValue("url"));
      return <div>{url.pathname}</div>;
    },
  },
  {
    id: "actions",
    cell: ({ row }) => {
      return (
        <div className="text-right">
          <DataTableRowActions row={row} />
        </div>
      );
    },
  },
];
