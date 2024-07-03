"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Image from "next/image";
import Link from "next/link";
import * as z from "zod";

import type { Maintenance, Page } from "@openstatus/db/src/schema";
import {
  Badge,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@openstatus/ui";

import { ArrowUpRight, Check } from "lucide-react";
import { DataTableRowActions } from "./data-table-row-actions";
import { DataTableBadges } from "../data-table-badges";

export const columns: ColumnDef<
  Page & {
    monitorsToPages: { monitor: { name: string } }[];
    maintenancesToPages: Maintenance[]; // we get only the active maintenances!
  }
>[] = [
  {
    accessorKey: "title",
    header: "Title",
    cell: ({ row }) => {
      return (
        <div className="flex items-center gap-1">
          <Link
            href={`./status-pages/${row.original.id}/edit`}
            className="group flex items-center gap-2"
          >
            <span className="max-w-[125px] truncate group-hover:underline">
              {row.getValue("title")}
            </span>
          </Link>
          <TooltipProvider>
            <Tooltip delayDuration={100}>
              <TooltipTrigger>
                <a
                  href={
                    process.env.NODE_ENV === "production"
                      ? `https://${row.original.slug}.openstatus.dev`
                      : `/status-page/${row.original.slug}`
                  }
                  target="_blank"
                  rel="noreferrer"
                  className="text-muted-foreground hover:text-foreground"
                >
                  <ArrowUpRight className="h-4 w-4 flex-shrink-0" />
                </a>
              </TooltipTrigger>
              <TooltipContent>Visit page</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
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
      return (
        <DataTableBadges
          names={monitors.map((monitor) => monitor.monitor.name)}
        />
      );
    },
  },
  {
    accessorKey: "icon",
    header: "Favicon",
    cell: ({ row }) => {
      if (!row.getValue("icon")) {
        return <span className="text-muted-foreground/50">-</span>;
      }
      return (
        <Image
          src={row.getValue("icon")}
          alt=""
          className="rounded-sm border border-border"
          width={20}
          height={20}
        />
      );
    },
  },
  {
    accessorKey: "passwordProtected",
    header: "Protected",
    cell: ({ row }) => {
      const passwordProtected = Boolean(row.getValue("passwordProtected"));
      if (passwordProtected) {
        return <Check className="h-4 w-4 text-foreground" />;
      }
      return <span className="text-muted-foreground/50">-</span>;
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
