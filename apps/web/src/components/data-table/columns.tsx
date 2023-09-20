"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";

import type { Ping } from "@openstatus/tinybird";

import { regionsDict } from "@/data/regions-dictionary";
import { DataTableColumnHeader } from "./data-table-column-header";
import { DataTableRowActions } from "./data-table-row-action";
import { DataTableStatusBadge } from "./data-table-status-badge";

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
      return <DataTableStatusBadge {...{ statusCode }} />;
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
