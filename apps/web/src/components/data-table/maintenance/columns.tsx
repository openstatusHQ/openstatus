"use client";

import type { ColumnDef } from "@tanstack/react-table";

import type { Maintenance } from "@openstatus/db/src/schema";

import { formatDateTime } from "@/lib/utils";
import { format } from "date-fns";
import { DataTableRowActions } from "./data-table-row-actions";

export const columns: ColumnDef<Maintenance>[] = [
  {
    accessorKey: "title",
    header: "Title",
  },
  {
    accessorKey: "message",
    header: "Message",
    cell: ({ row }) => {
      return (
        <p className="flex max-w-[125px] lg:max-w-[250px] xl:max-w-[350px]">
          <span className="truncate">{row.getValue("message")}</span>
        </p>
      );
    },
  },
  {
    accessorKey: "from",
    header: "Start",
    cell: ({ row }) => {
      return (
        <p className="text-muted-foreground">
          {format(row.getValue("from"), "LLL dd, y HH:mm zzzz")}
        </p>
      );
    },
  },
  {
    accessorKey: "to",
    header: "End",
    cell: ({ row }) => {
      return (
        <p className="text-muted-foreground">
          {format(row.getValue("to"), "LLL dd, y HH:mm zzzz")}
        </p>
      );
    },
  },
  // missing: from, to
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
