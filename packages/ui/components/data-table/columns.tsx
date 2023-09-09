"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";

import type { Ping } from "@openstatus/tinybird";

import { Badge } from "@/components/ui/badge";
import { regionsDict } from "@/data/regions-dictionary";
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
          {format(new Date(row.getValue("timestamp")), "LLL dd, y HH:mm")}
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
      <DataTableColumnHeader column={column} title="Latency (ms)" />
    ),
  },
  {
    accessorKey: "region",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Region" />
    ),
    cell: ({ row }) => {
      const region = String(row.getValue("region"));
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      return <div>{regionsDict[region]?.location}</div>;
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id));
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
