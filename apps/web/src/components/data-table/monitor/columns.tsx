"use client";

import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";

import type { Monitor } from "@openstatus/db/src/schema";
import { Badge } from "@openstatus/ui";

import { StatusDot } from "@/components/monitor/status-dot";
import { DataTableRowActions } from "./data-table-row-actions";

export const columns: ColumnDef<Monitor>[] = [
  {
    accessorKey: "name",
    header: "Name",
    cell: ({ row }) => {
      const { active, status } = row.original;
      return (
        <Link
          href={`./monitors/${row.original.id}/overview`}
          className="group flex items-center gap-2"
        >
          <StatusDot active={active} status={status} />
          <span className="max-w-[125px] truncate group-hover:underline">
            {row.getValue("name")}
          </span>
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
      const { active, status } = row.original;

      if (!active) return <Badge variant="secondary">pause</Badge>;
      if (status === "error") return <Badge variant="destructive">down</Badge>;
      return <Badge variant="outline">up</Badge>;
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
