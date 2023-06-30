"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Ping } from "../data/schema";
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
          {/* FIXME: 24:00 and 00:00 are rendered differently on server and client - or use formatDistance */}
          {new Intl.DateTimeFormat("en", {
            // dateStyle: "short",
            // timeStyle: "short",
            // hour12: false,
            // hourCycle: "h23",
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
      // TODO: filter function? not right?
      return value.includes(row.getValue(id));
    },
  },
  {
    accessorKey: "latency",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Latency" />
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
