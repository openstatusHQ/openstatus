"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import type * as z from "zod";

import { flyRegionsDict } from "@openstatus/utils";

import type { Trigger } from "@/lib/monitor/utils";
import type { monitorFlyRegionSchema } from "@openstatus/db/src/schema/constants";
import { TriggerIconWithTooltip } from "../monitor/trigger-icon-with-tooltip";
import { DataTableColumnHeader } from "./data-table-column-header";
import { DataTableStatusBadge } from "./data-table-status-badge";

export type Check = {
  type: "http" | "tcp";
  monitorId: string;
  latency: number;
  region: z.infer<typeof monitorFlyRegionSchema>;
  statusCode?: number | null;
  timestamp: number;
  workspaceId: string;
  cronTimestamp: number | null;
  error: boolean;
  trigger: Trigger | null;
};

export const columns: ColumnDef<Check>[] = [
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
      const statusCode = row.getValue("statusCode") as
        | number
        | null
        | undefined;

      if (statusCode) {
        return <DataTableStatusBadge {...{ statusCode }} />;
      }

      return <div className="text-muted-foreground">N/A</div>;
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
        return Number.parseInt(row.getValue(id)) > Number.parseInt(input);
      if (select === "max" && input)
        return Number.parseInt(row.getValue(id)) < Number.parseInt(input);
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
            {flyRegionsDict[row.original.region]?.location}
          </span>
        </div>
      );
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id));
    },
  },
  {
    accessorKey: "trigger",
    header: () => null,
    cell: ({ row }) => {
      const value = row.getValue("trigger") as Trigger;
      return <TriggerIconWithTooltip triggerType={value} />;
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id));
    },
  },
];
