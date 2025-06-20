"use client";

import { HoverCardTimestamp } from "@/components/common/hover-card-timestamp";
import { TableCellDate } from "@/components/data-table/table-cell-date";
import { TableCellNumber } from "@/components/data-table/table-cell-number";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ResponseLog } from "@/data/response-logs";
import { statusCodes } from "@/data/status-codes";
import { cn } from "@/lib/utils";
import { HoverCardPortal } from "@radix-ui/react-hover-card";
import type { ColumnDef } from "@tanstack/react-table";
import { Clock, Workflow } from "lucide-react";

const icons = {
  scheduled: Clock,
  "on-demand": Workflow,
};

export const columns: ColumnDef<ResponseLog>[] = [
  {
    accessorKey: "error",
    header: () => null,
    enableSorting: false,
    enableHiding: false,
    cell: ({ row }) => {
      const value = row.getValue("error");
      if (typeof value === "boolean") {
        if (value) {
          return <div className="h-2.5 w-2.5 rounded-[2px] bg-destructive" />;
        }
        return <div className="h-2.5 w-2.5 rounded-[2px] bg-muted" />;
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
          <TableCellDate value={value} className="text-foreground" />
        </HoverCardTimestamp>
      );
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    enableSorting: false,
    enableHiding: false,
    cell: ({ row }) => {
      const value = row.getValue("status");
      const status = statusCodes.find((s) => s.code === value);
      return <TableCellNumber value={value} className={status?.text} />;
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
    enableSorting: false,
    enableHiding: false,
    meta: {
      cellClassName: "text-muted-foreground font-mono",
    },
  },
  {
    accessorKey: "timing",
    header: "Timing",
    cell: ({ row }) => {
      const value = row.getValue("timing") as ResponseLog["timing"];
      return <HoverCardTiming timing={value} latency={row.original.latency} />;
    },
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "type",
    header: "Type",
    cell: ({ row }) => {
      const value = row.getValue("type");
      if (value === "scheduled" || value === "on-demand") {
        const Icon = icons[value];
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Icon className="size-3 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent side="right">
                <p className="capitalize">{value}</p>
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

function HoverCardTiming({
  timing,
  latency,
}: {
  timing: ResponseLog["timing"];
  latency: ResponseLog["latency"];
}) {
  return (
    <HoverCard openDelay={50} closeDelay={50}>
      <HoverCardTrigger
        className="opacity-70 hover:opacity-100 data-[state=open]:opacity-100"
        asChild
      >
        <div className="flex">
          {Object.entries(timing).map(([key, value], index) => (
            <div
              key={key}
              className={cn("h-4")}
              style={{
                width: `${(value / latency) * 100}%`,
                backgroundColor: `var(--chart-${index + 1})`,
              }}
            />
          ))}
        </div>
      </HoverCardTrigger>
      {/* REMINDER: allows us to port the content to the document.body, which is helpful when using opacity-50 on the row element */}
      <HoverCardPortal>
        <HoverCardContent side="bottom" align="end" className="z-10 w-auto p-2">
          <HoverCardTimingContent {...{ latency, timing }} />
        </HoverCardContent>
      </HoverCardPortal>
    </HoverCard>
  );
}

function HoverCardTimingContent({
  timing,
  latency,
}: {
  timing: ResponseLog["timing"];
  latency: ResponseLog["latency"];
}) {
  return (
    <div className="flex flex-col gap-1">
      {Object.entries(timing).map(([key, value], index) => {
        return (
          <div key={key} className="grid grid-cols-2 gap-4 text-xs">
            <div className="flex items-center gap-2">
              <div
                className={cn("h-2 w-2 rounded-full")}
                style={{ backgroundColor: `var(--chart-${index + 1})` }}
              />
              <div className="font-mono text-accent-foreground uppercase">
                {key}
              </div>
            </div>
            <div className="flex items-center justify-between gap-4">
              <div className="font-mono text-muted-foreground">
                {`${new Intl.NumberFormat("en-US", {
                  maximumFractionDigits: 2,
                }).format((value / latency) * 100)}%`}
              </div>
              <div className="font-mono">
                {new Intl.NumberFormat("en-US", {
                  maximumFractionDigits: 3,
                }).format(value)}
                <span className="text-muted-foreground">ms</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
