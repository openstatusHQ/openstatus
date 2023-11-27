"use client";

import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import * as z from "zod";

import type { Monitor } from "@openstatus/db/src/schema";
import { Badge } from "@openstatus/ui";

import { DataTableStatusBadge } from "../data-table-status-badge";
import { DataTableRowActions } from "./data-table-row-actions";

export const columns: ColumnDef<Monitor & { lastStatusCode?: number }>[] = [
  {
    accessorKey: "name",
    header: "Name",
    cell: ({ row }) => {
      const active = row.getValue("active");
      return (
        // TODO: add Link on click when we have a better details page
        <Link
          href={`./monitors/${row.original.id}/data`}
          className="group flex items-center gap-2"
        >
          {active ? (
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500/80 opacity-75 duration-1000" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
            </span>
          ) : (
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-2 w-2 rounded-full bg-red-500" />
            </span>
          )}
          <span className="max-w-[125px] truncate group-hover:underline">
            {row.getValue("name")}
          </span>
          {!active ? <Badge variant="outline">paused</Badge> : null}
        </Link>
      );
    },
  },
  {
    accessorKey: "url",
    header: "URL",
    cell: ({ row }) => {
      return (
        <div className="flex">
          <span className="max-w-[150px] truncate font-medium sm:max-w-[200px] lg:max-w-[250px] xl:max-w-[350px]">
            {row.getValue("url")}
          </span>
        </div>
      );
    },
  },
  {
    // hidden by `columnVisibility` in `data-table.tsx` but used via row.getValue("active")
    accessorKey: "active",
    header: "Active",
    cell: ({ row }) => {
      const active = row.getValue("active");
      if (!active) {
        return <span className="text-muted-foreground">paused</span>;
      }
      return <span>running</span>;
    },
  },
  {
    accessorKey: "lastStatusCode",
    header: "Last Status",
    cell: ({ row }) => {
      const lastStatusCode = row.getValue("lastStatusCode");
      const statusCode = z.number().nullable().optional().parse(lastStatusCode);

      if (statusCode === undefined) {
        return <span className="text-muted-foreground">Missing</span>;
      }

      return <DataTableStatusBadge {...{ statusCode }} />;
    },
  },
  {
    accessorKey: "periodicity",
    header: "Frequency",
    cell: ({ row }) => {
      return <span className="font-mono">{row.getValue("periodicity")}</span>;
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
