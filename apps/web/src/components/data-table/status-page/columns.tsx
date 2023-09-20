"use client";

import Image from "next/image";
import type { ColumnDef } from "@tanstack/react-table";
import * as z from "zod";

import type { Page } from "@openstatus/db/src/schema";

import { formatDate } from "@/lib/utils";
import { DataTableRowActions } from "./data-table-row-actions";

// TODO: add total number of monitors

export const columns: ColumnDef<Page>[] = [
  {
    accessorKey: "title",
    header: "Title",
    cell: ({ row }) => {
      return <span className="truncate">{row.getValue("title")}</span>;
    },
  },
  {
    accessorKey: "slug",
    header: "Slug",
    cell: ({ row }) => {
      return <span className="font-mono">{row.getValue("slug")}</span>;
    },
  },
  {
    accessorKey: "icon",
    header: "Favicon",
    cell: ({ row }) => {
      if (!row.getValue("icon")) {
        return <span className="text-muted-foreground">Missing</span>;
      }
      return (
        <Image
          src={row.getValue("icon")}
          alt=""
          className="border-border rounded-sm border"
          width={20}
          height={20}
        />
      );
    },
  },
  {
    accessorKey: "createdAt",
    header: "Created",
    cell: ({ row }) => {
      return <span>{formatDate(row.getValue("createdAt"))}</span>;
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
