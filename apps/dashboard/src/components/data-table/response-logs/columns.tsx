"use client";

import { HoverCardTimestamp } from "@/components/common/hover-card-timestamp";
import { HoverCardTiming } from "@/components/common/hover-card-timing";
import { TableCellDate } from "@/components/data-table/table-cell-date";
import { TableCellNumber } from "@/components/data-table/table-cell-number";
import { TableCellRegion } from "@/components/data-table/table-cell-region";
import { getStatusCodeVariant, textColors } from "@/data/status-codes";
import type { RouterOutputs } from "@openstatus/api";
import type { PrivateLocation } from "@openstatus/db/src/schema";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@openstatus/ui/components/ui/tooltip";
import type { ColumnDef } from "@tanstack/react-table";
import { Clock, Workflow } from "lucide-react";

type ResponseLog = RouterOutputs["tinybird"]["list"]["data"][number];

// export const columns: ColumnDef<ResponseLog>[] =
export function getColumns(
  privateLocations: PrivateLocation[],
): ColumnDef<ResponseLog>[] {
  return [
    {
      accessorKey: "requestStatus",
      header: () => null,
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => {
        const value = row.getValue("requestStatus");
        if (value === "error") {
          return <div className="h-2.5 w-2.5 rounded-[2px] bg-destructive" />;
        }
        if (value === "degraded") {
          return <div className="h-2.5 w-2.5 rounded-[2px] bg-warning" />;
        }
        if (value === "success") {
          return <div className="h-2.5 w-2.5 rounded-[2px] bg-success" />;
        }
        return <div className="text-muted-foreground">-</div>;
      },
    },
    {
      accessorKey: "timestamp",
      header: "Timestamp",
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => {
        const value = new Date(row.getValue("timestamp"));
        return (
          <HoverCardTimestamp date={value}>
            <TableCellDate
              value={value}
              className="font-mono text-foreground"
            />
          </HoverCardTimestamp>
        );
      },
    },
    {
      accessorKey: "statusCode",
      header: "Status",
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => {
        const log = row.original;
        if (log.type === "http") {
          const value = log.statusCode;
          const variant = getStatusCodeVariant(value);
          return (
            <TableCellNumber value={value} className={textColors[variant]} />
          );
        }
        return <div className="text-muted-foreground">-</div>;
      },
    },
    {
      accessorKey: "latency",
      header: "Latency",
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => {
        return <TableCellNumber value={row.getValue("latency")} unit="ms" />;
      },
    },
    {
      accessorKey: "region",
      header: "Region",
      cell: ({ row }) => (
        <TableCellRegion
          value={row.getValue("region")}
          privateLocations={privateLocations}
        />
      ),
      enableSorting: false,
      enableHiding: false,
      filterFn: "arrIncludesSome",
      meta: {
        cellClassName: "text-muted-foreground font-mono",
      },
    },
    {
      accessorKey: "timing",
      header: "Timing",
      cell: ({ row }) => {
        const log = row.original;
        if (log.type === "http" && log.timing) {
          return <HoverCardTiming timing={log.timing} latency={log.latency} />;
        }
        return <div className="text-muted-foreground">-</div>;
      },
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "trigger",
      header: "Trigger",
      cell: ({ row }) => {
        const value = row.getValue("trigger");
        if (value === "cron" || value === "api") {
          const Icon = value === "cron" ? Clock : Workflow;
          const label = value === "cron" ? "Scheduled" : "API";
          return (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Icon className="size-3 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p>{label}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        }
        return <div className="text-muted-foreground">-</div>;
      },
      enableSorting: false,
      enableHiding: false,
      meta: {
        cellClassName: "font-mono",
        headerClassName: "sr-only",
      },
    },
  ];
}
