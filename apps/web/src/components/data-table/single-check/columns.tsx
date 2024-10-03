"use client";

import { formatNumber } from "@/components/monitor-dashboard/metrics-card";
import { StatusCodeBadge } from "@/components/monitor/status-code-badge";
import { getTimingPhases } from "@/components/ping-response-analysis/utils";
import { getTimingColor, getTimingPercentage } from "@/lib/timing";
import { cn, formatDate } from "@/lib/utils";
import type { SingleChecker } from "@openstatus/tinybird";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@openstatus/ui";
import { flyRegionsDict } from "@openstatus/utils";
import type { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";

export const columns: ColumnDef<SingleChecker>[] = [
  {
    accessorKey: "timestamp",
    header: "Timestamp",
    cell: ({ row }) => {
      const timestamp = row.original.timestamp;
      if (!timestamp) return null;
      return (
        <div className="font-mono">
          {format(new Date(timestamp), "LLL dd, y HH:mm:ss")}
        </div>
      );
    },
  },
  {
    accessorKey: "region",
    header: "Region",
    cell: ({ row }) => {
      const region = row.original.region;
      const { code, flag, location } = flyRegionsDict[region];
      return (
        <div>
          <p className="text-muted-foreground text-xs">{location}</p>
          <p className="font-mono text-xs">
            {flag} {code}
          </p>
        </div>
      );
    },
  },
  {
    accessorKey: "status",
    header: "Status Code", // add whitespace-nowrap
    cell: ({ row }) => {
      const status = row.original.status;
      if (!status) return null;
      return <StatusCodeBadge statusCode={status} />;
    },
  },
  {
    accessorKey: "latency",
    header: "Latency",
    cell: ({ row }) => {
      const latency = row.original.latency;
      return <div className="font-mono">{formatNumber(latency)}ms</div>;
    },
  },
  {
    accessorKey: "requestId",
    header: "Request Id", // add whitespace-nowrap
    cell: ({ row }) => {
      return <div className="font-mono">{row.getValue("requestId")}</div>;
    },
  },
  {
    accessorKey: "headers",
    header: "Headers",
    cell: ({ row }) => {
      return (
        <div className="font-mono truncate max-w-56">
          {JSON.stringify(row.getValue("headers"))}
        </div>
      );
    },
  },
  {
    accessorKey: "timing",
    header: () => <div className="whitespace-nowrap">Timing Phases</div>,
    cell: ({ row }) => {
      const { timing, latency } = row.original;
      const timingPhases = getTimingPhases(timing);
      const percentage = getTimingPercentage(timingPhases, latency);
      return (
        <HoverCard>
          <HoverCardTrigger
            className="opacity-70 data-[state=open]:opacity-100 hover:opacity-100"
            asChild
          >
            <div className="flex">
              {Object.entries(timingPhases).map(([key, value]) => (
                <div
                  key={key}
                  className={cn(getTimingColor(key), "h-4")}
                  style={{ width: `${(value / latency) * 100}%` }}
                />
              ))}
            </div>
          </HoverCardTrigger>
          <HoverCardContent side="bottom" className="p-2 w-auto">
            <div className="flex flex-col gap-1">
              {Object.entries(timingPhases).map(([key, value]) => {
                const color = getTimingColor(key);
                return (
                  <div key={key} className="grid grid-cols-2 gap-4 text-xs">
                    <div className="flex items-center gap-2">
                      <div className={cn(color, "h-2 w-2 rounded-full")} />
                      <div className="uppercase text-accent-foreground">
                        {key}
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <div className="font-mono text-muted-foreground">
                        {percentage[key]}
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
          </HoverCardContent>
        </HoverCard>
      );
    },
  },
];
