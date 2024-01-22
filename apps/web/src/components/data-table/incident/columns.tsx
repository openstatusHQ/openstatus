"use client";

import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";

import type { Incident } from "@openstatus/db/src/schema";

import { DataTableRowActions } from "./data-table-row-actions";

export const columns: ColumnDef<Incident>[] = [
  {
    accessorKey: "monitorId",
    header: "Monitor",
    cell: ({ row }) => {
      return (
        <Link
          href={`./monitors/${row.original.id}/overview`}
          className="group flex items-center gap-2"
        >
          <span className="max-w-[125px] truncate group-hover:underline">
            {row.original.monitorName}
          </span>
        </Link>
      );
    },
  },
  {
    accessorKey: "startedAt",
    header: "Started At",
    cell: ({ row }) => {
      const { startedAt } = row.original;
      const date = startedAt ? new Date(startedAt).toLocaleString() : "-";
      return (
        <div className="flex">
          <span className="text-muted-foreground max-w-[150px] truncate sm:max-w-[200px] lg:max-w-[250px] xl:max-w-[350px]">
            {date}
          </span>
        </div>
      );
    },
  },
  {
    accessorKey: "acknowledgetAt",
    header: "Acknowledged At",
    cell: ({ row }) => {
      const { acknowledgedAt } = row.original;
      const date = acknowledgedAt
        ? new Date(acknowledgedAt).toLocaleString()
        : "-";
      return (
        <div className="flex">
          <span className="text-muted-foreground max-w-[150px] truncate sm:max-w-[200px] lg:max-w-[250px] xl:max-w-[350px]">
            {date}
          </span>
        </div>
      );
    },
  },
  {
    accessorKey: "resolvedAt",
    header: "Resolved At",
    cell: ({ row }) => {
      const { resolvedAt } = row.original;
      const date = resolvedAt ? new Date(resolvedAt).toLocaleString() : "-";
      return (
        <div className="flex">
          <span className="text-muted-foreground max-w-[150px] truncate sm:max-w-[200px] lg:max-w-[250px] xl:max-w-[350px]">
            {date}
          </span>
        </div>
      );
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
