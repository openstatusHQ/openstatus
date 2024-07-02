"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";

import type {
  StatusReport,
  StatusReportUpdate,
} from "@openstatus/db/src/schema";

import { StatusBadge } from "@/components/status-update/status-badge";
import { formatDate } from "@/lib/utils";
import { DataTableRowActions } from "./data-table-row-actions";

export const columns: ColumnDef<
  StatusReport & { statusReportUpdates: StatusReportUpdate[] }
>[] = [
  {
    accessorKey: "title",
    header: "Title",
    cell: ({ row }) => {
      const id = row.original.id;
      return (
        <Link href={`./reports/${id}/overview`} className="hover:underline">
          <span className="truncate">{row.getValue("title")}</span>
        </Link>
      );
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.original.status;
      return <StatusBadge status={status} />;
    },
  },
  {
    accessorKey: "statusReportUpdates",
    header: "Updates",
    cell: ({ row }) => {
      const statusReportUpdates = row.original.statusReportUpdates;
      return <code>{statusReportUpdates.length}</code>;
    },
  },
  {
    accessorKey: "updatedAt",
    header: "Last Updated",
    cell: ({ row }) => {
      return <span>{formatDate(row.getValue("updatedAt"))}</span>;
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
