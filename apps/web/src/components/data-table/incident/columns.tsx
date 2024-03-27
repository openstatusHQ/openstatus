"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { formatDistanceStrict } from "date-fns";
import Link from "next/link";

import type { Incident } from "@openstatus/db/src/schema";

import { formatDateTime } from "@/lib/utils";
import { DataTableRowActions } from "./data-table-row-actions";

export const columns: ColumnDef<Incident>[] = [
  {
    accessorKey: "monitorId",
    header: "Monitor",
    cell: ({ row }) => {
      return (
        <Link
          href={`./monitors/${row.original.monitorId}/overview`}
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
      const date = startedAt ? formatDateTime(startedAt) : "-";
      return (
        <div className="flex">
          <span className="max-w-[150px] truncate text-muted-foreground lg:max-w-[250px] sm:max-w-[200px] xl:max-w-[350px]">
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
      const date = acknowledgedAt ? formatDateTime(acknowledgedAt) : "-";
      return (
        <div className="flex">
          <span className="max-w-[150px] truncate text-muted-foreground lg:max-w-[250px] sm:max-w-[200px] xl:max-w-[350px]">
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
      const date = resolvedAt ? formatDateTime(resolvedAt) : "-";
      return (
        <div className="flex">
          <span className="max-w-[150px] truncate text-muted-foreground lg:max-w-[250px] sm:max-w-[200px] xl:max-w-[350px]">
            {date}
          </span>
        </div>
      );
    },
  },
  {
    header: "Duration",
    cell: ({ row }) => {
      const { startedAt, resolvedAt } = row.original;

      if (!resolvedAt) {
        return <span className="text-muted-foreground">-</span>;
      }

      const duration = formatDistanceStrict(
        new Date(startedAt),
        new Date(resolvedAt),
      );
      return (
        <div className="flex">
          <span className="max-w-[150px] truncate text-muted-foreground lg:max-w-[250px] sm:max-w-[200px] xl:max-w-[350px]">
            {duration}
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
