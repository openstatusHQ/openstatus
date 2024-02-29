"use client";

import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { formatDistanceToNowStrict } from "date-fns";

import type { Incident, Monitor } from "@openstatus/db/src/schema";
import type {
  Monitor as MonitorTracker,
  ResponseTimeMetrics,
} from "@openstatus/tinybird";
import { Tracker } from "@openstatus/tracker";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@openstatus/ui";

import { StatusDot } from "@/components/monitor/status-dot";
import { Bar } from "@/components/tracker/tracker";
import { DataTableRowActions } from "./data-table-row-actions";

export const columns: ColumnDef<{
  monitor: Monitor;
  metrics?: ResponseTimeMetrics;
  data?: MonitorTracker[];
  incidents?: Incident[];
}>[] = [
  {
    accessorKey: "name",
    header: "Name",
    cell: ({ row }) => {
      const { active, status, name } = row.original.monitor;
      return (
        <Link
          href={`./monitors/${row.original.monitor.id}/overview`}
          className="group flex max-w-[150px] items-center gap-2 md:max-w-[250px]"
        >
          <StatusDot active={active} status={status} />
          <span className="truncate group-hover:underline">{name}</span>
        </Link>
      );
    },
  },
  {
    accessorKey: "tracker",
    header: "Last 7 days",
    cell: ({ row }) => {
      const tracker = new Tracker({
        data: row.original.data?.slice(0, 7).reverse(),
        incidents: row.original.incidents,
      });
      return (
        <div className="flex w-24 gap-1">
          {tracker.days?.map((tracker) => (
            <Bar key={tracker.day} className="h-5" {...tracker} />
          ))}
        </div>
      );
    },
  },
  {
    accessorKey: "lastTimestamp",
    header: "Last ping",
    cell: ({ row }) => {
      const timestamp = row.original.metrics?.lastTimestamp;
      if (timestamp) {
        const distance = formatDistanceToNowStrict(new Date(timestamp), {
          addSuffix: true,
        });
        return (
          <div className="text-muted-foreground flex max-w-[84px] sm:max-w-none">
            <span className="truncate">{distance}</span>
          </div>
        );
      }
      return <span className="text-muted-foreground">-</span>;
    },
  },
  {
    accessorKey: "uptime",
    header: () => <HeaderTooltip>Uptime</HeaderTooltip>,
    cell: ({ row }) => {
      const { count, ok } = row.original?.metrics || {};
      if (!count || !ok)
        return <span className="text-muted-foreground">-</span>;
      const rounded = Math.round((ok / count) * 10_000) / 100;
      return <Number value={rounded} suffix="%" />;
    },
  },
  {
    accessorKey: "avgLatency",
    header: () => <HeaderTooltip>P50</HeaderTooltip>,
    cell: ({ row }) => {
      const latency = row.original.metrics?.avgLatency;
      if (latency) return <Number value={latency} suffix="ms" />;
      return <span className="text-muted-foreground">-</span>;
    },
  },
  {
    accessorKey: "p95Latency",
    header: () => <HeaderTooltip>P95</HeaderTooltip>,
    cell: ({ row }) => {
      const latency = row.original.metrics?.p95Latency;
      if (latency) return <Number value={latency} suffix="ms" />;
      return <span className="text-muted-foreground">-</span>;
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

function HeaderTooltip({ children }: { children: string }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger className="underline decoration-dotted">
          {children}
        </TooltipTrigger>
        <TooltipContent>Data from the last 24h</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function Number({ value, suffix }: { value: number; suffix: string }) {
  return (
    <span className="font-mono">
      {new Intl.NumberFormat("us").format(value).toString()}
      <span className="text-muted-foreground text-xs font-normal">
        {suffix}
      </span>
    </span>
  );
}
