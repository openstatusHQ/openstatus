"use client";

import { Pill } from "@/components/pill";
import type { Check } from "@openstatus/db/src/schema";
import type { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { Minus } from "lucide-react";
import { DataTableBadges } from "../data-table-badges";

export const columns: ColumnDef<Check>[] = [
  {
    accessorKey: "createdAt",
    header: "Created At",
    cell: ({ row }) => {
      const createdAt = row.original.createdAt;
      if (!createdAt) return null;
      return (
        <div className="font-mono">
          {format(new Date(createdAt), "LLL dd, y HH:mm:ss")}
        </div>
      );
    },
    meta: {
      headerClassName: "whitespace-nowrap",
    },
  },
  {
    accessorKey: "url",
    header: "URL",
    cell: ({ row }) => {
      return (
        <div className="max-w-[350px] truncate">{row.getValue("url")}</div>
      );
    },
  },
  {
    accessorKey: "metadata",
    header: "Metadata",
    cell: ({ row }) => {
      const metadata = row.original.metadata;
      if (!Object.keys(metadata).length) return null;
      return (
        <div className="flex flex-wrap gap-1">
          {Object.entries(metadata).map(([key, value]) => (
            <Pill key={key} label={key}>
              {value}
            </Pill>
          ))}
        </div>
      );
    },
  },
  {
    accessorKey: "regions",
    header: "Regions",
    cell: ({ row }) => {
      const regions = row.original.regions;
      if (!regions.length)
        return <Minus className="h-4 w-4 text-muted-foreground" />;
      return <DataTableBadges names={regions} />;
    },
  },
  {
    accessorKey: "countRequests",
    header: "Request Count",
    cell: ({ row }) => {
      return <div>#{row.getValue("countRequests") || 0}</div>;
    },
    meta: {
      headerClassName: "whitespace-nowrap",
    },
  },
  {
    accessorKey: "id",
  },
];
