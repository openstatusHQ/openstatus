"use client";

import type { ColumnDef } from "@tanstack/react-table";

import type { Maintenance } from "@openstatus/db/src/schema";

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
