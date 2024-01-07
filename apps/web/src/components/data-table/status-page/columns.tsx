"use client";

import Image from "next/image";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import * as z from "zod";

import type { Page } from "@openstatus/db/src/schema";
import { Badge } from "@openstatus/ui";

import { DataTableRowActions } from "./data-table-row-actions";

// TODO: add total number of monitors

export const columns: ColumnDef<
  Page & { monitorsToPages: { monitor: { name: string } }[] }
>[] = [
  {
    accessorKey: "title",
    header: "Title",
    cell: ({ row }) => {
      return (
        <Link
          href={`./status-pages/${row.original.id}/edit`}
          className="group flex items-center gap-2"
        >
          <span className="max-w-[125px] truncate group-hover:underline">
            {row.getValue("title")}
          </span>
        </Link>
      );
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
    accessorKey: "monitorsToPages",
    header: "Monitors",
    cell: ({ row }) => {
      const monitorsToPages = row.getValue("monitorsToPages");
      const monitors = z
        .object({ monitor: z.object({ name: z.string() }) })
        .array()
        .parse(monitorsToPages);
      const amount = 3;
      return (
        <div className="flex items-center gap-2">
          <span className="flex max-w-[150px] gap-2 truncate font-medium sm:max-w-[200px] lg:max-w-[250px] xl:max-w-[350px]">
            {monitors.slice(0, amount).map(({ monitor: { name } }, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey:
              <Badge key={i} variant="outline">
                {name}
              </Badge>
            ))}
          </span>
          <span className="font-medium">
            {monitors.length > amount ? (
              <span>+{monitors.length - amount}</span>
            ) : null}
          </span>
        </div>
      );
    },
  },
  {
    accessorKey: "icon",
    header: "Favicon",
    cell: ({ row }) => {
      if (!row.getValue("icon")) {
        return <span className="text-muted-foreground">-</span>;
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
  // {
  //   accessorKey: "createdAt",
  //   header: "Created",
  //   cell: ({ row }) => {
  //     return <span>{formatDate(row.getValue("createdAt"))}</span>;
  //   },
  // },
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
