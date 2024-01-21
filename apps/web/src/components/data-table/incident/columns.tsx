"use client";

import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";

import type { Incident } from "@openstatus/db/src/schema";
import { Badge } from "@openstatus/ui";

import { DataTableRowActions } from "./data-table-row-actions";

export const columns: ColumnDef<Incident>[] = [
  {
    accessorKey: "name",
    header: "Name",
    cell: ({ row }) => {
      return (
        <Link
          href={`./monitors/${row.original.id}/overview`}
          className="group flex items-center gap-2"
        >
          <span className="max-w-[125px] truncate group-hover:underline">
            {row.getValue("name")}
          </span>
        </Link>
      );
    },
  },
  {
    accessorKey: "monitorId",
    header: "URL",
    cell: ({ row }) => {
      return (
        <div className="flex">
          <span className="max-w-[150px] truncate font-medium sm:max-w-[200px] lg:max-w-[250px] xl:max-w-[350px]">
            {row.getValue("monitorId")}
          </span>
        </div>
      );
    },
  },
  {
    accessorKey: "description",
    header: "Description",
    cell: ({ row }) => {
      return (
        <div className="flex">
          <span className="text-muted-foreground max-w-[150px] truncate sm:max-w-[200px] lg:max-w-[250px] xl:max-w-[350px]">
            {row.getValue("description") || "-"}
          </span>
        </div>
      );
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const { status } = row.original;
      return <Badge variant="outline">{status}</Badge>;
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
