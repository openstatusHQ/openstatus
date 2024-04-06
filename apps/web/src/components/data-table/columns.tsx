"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import * as z from "zod";

import type { Ping } from "@openstatus/tinybird";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@openstatus/ui";
import { regionsDict } from "@openstatus/utils";

import { DataTableColumnHeader } from "./data-table-column-header";
import { DataTableStatusBadge } from "./data-table-status-badge";

export const columns: ColumnDef<Ping>[] = [
  {
    accessorKey: "error",
    header: () => null,
    cell: ({ row }) => {
      if (row.original.error)
        return <div className="h-2.5 w-2.5 rounded-full bg-rose-500" />;
      return <div className="h-2.5 w-2.5 rounded-full bg-green-500" />;
    },
    filterFn: (row, id, value) => value.includes(row.getValue(id)),
  },
  {
    accessorKey: "cronTimestamp",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Date" />
    ),
    cell: ({ row }) => {
      return (
        <div>
          {format(new Date(row.getValue("cronTimestamp")), "LLL dd, y HH:mm")}
        </div>
      );
    },
  },
  {
    accessorKey: "statusCode",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" />
    ),
    cell: ({ row }) => {
      const unsafe_StatusCode = row.getValue("statusCode");
      const statusCode = z.number().nullable().parse(unsafe_StatusCode);
      const message = row.original.message;

      if (statusCode !== null) {
        return <DataTableStatusBadge {...{ statusCode }} />;
      }

      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <DataTableStatusBadge {...{ statusCode }} />
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-muted-foreground max-w-xs sm:max-w-sm">
                {message}
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    },
    filterFn: (row, id, value) => {
      // get the first digit of the status code
      return value.includes(Number(String(row.getValue(id)).charAt(0)));
    },
  },
  {
    accessorKey: "latency",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Latency (ms)" />
    ),
    filterFn: (row, id, value) => {
      const { select, input } = value || {};
      if (select === "min" && input)
        return parseInt(row.getValue(id)) > parseInt(input);
      if (select === "max" && input)
        return parseInt(row.getValue(id)) < parseInt(input);
      return true;
    },
  },
  {
    accessorKey: "region",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Region" />
    ),
    cell: ({ row }) => {
      return (
        <div>
          <span className="font-mono">{String(row.getValue("region"))} </span>
          <span className="text-muted-foreground text-xs">
            {regionsDict[row.original.region]?.location}
          </span>
        </div>
      );
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id));
    },
  },
];
