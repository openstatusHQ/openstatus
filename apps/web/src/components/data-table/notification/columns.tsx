"use client";

import type { ColumnDef } from "@tanstack/react-table";

import type { Monitor, Notification } from "@openstatus/db/src/schema";
import { Badge } from "@openstatus/ui/src/components/badge";

import Link from "next/link";
import { z } from "zod";
import { DataTableBadges } from "../data-table-badges";
import { DataTableRowActions } from "./data-table-row-actions";

// TODO: use the getProviderMetaData function from the notification form to access the data

export const columns: ColumnDef<
  Notification & { monitor: { monitor: Monitor }[] }
>[] = [
  {
    accessorKey: "name",
    header: "Name",
    cell: ({ row }) => {
      const { name } = row.original;
      return (
        <div className="flex gap-2">
          <Link
            href={`./notifications/${row.original.id}/edit`}
            className="group flex max-w-full items-center gap-2"
            prefetch={false}
          >
            <span className="truncate group-hover:underline">{name}</span>
          </Link>
        </div>
      );
    },
  },
  {
    accessorKey: "provider",
    header: "Provider",
    cell: ({ row }) => {
      return (
        <Badge variant="secondary" className="capitalize">
          {row.getValue("provider")}
        </Badge>
      );
    },
  },
  {
    accessorKey: "monitor",
    header: "Monitors",
    cell: ({ row }) => {
      const monitor = row.getValue("monitor");
      const monitors = z
        .object({ monitor: z.object({ name: z.string() }) })
        .array()
        .parse(monitor);
      return (
        <DataTableBadges
          names={monitors.map((monitor) => monitor.monitor.name)}
        />
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
