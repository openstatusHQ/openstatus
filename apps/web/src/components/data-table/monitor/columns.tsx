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

import { StatusDotWithTooltip } from "@/components/monitor/status-dot-with-tooltip";
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
          <StatusDotWithTooltip active={active} status={status} />
          <span className="truncate group-hover:underline">{name}</span>
        </Link>
      );
    },
  },
  {
    accessorKey: "tracker",
    header: () => (
      <HeaderTooltip label="Last 7 days" content="UTC time period" />
    ),
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
    header: () => (
      <HeaderTooltip label="Uptime" content="Data from the last 24h" />
    ),
    cell: ({ row }) => {
      const { count, ok } = row.original?.metrics || {};
      if (!count || !ok)
        return <span className="text-muted-foreground">-</span>;
      const rounded = Math.round((ok / count) * 10_000) / 100;
      return <Number value={rounded} suffix="%" />;
    },
  },
  {
    accessorKey: "p50Latency",
    header: () => (
      <HeaderTooltip label="P50" content="Data from the last 24h" />
    ),
    cell: ({ row }) => {
      const latency = row.original.metrics?.p50Latency;
      if (latency) return <Number value={latency} suffix="ms" />;
      return <span className="text-muted-foreground">-</span>;
    },
  },
  {
    accessorKey: "p95Latency",
    header: () => (
      <HeaderTooltip label="P95" content="Data from the last 24h" />
    ),
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

function HeaderTooltip({ label, content }: { label: string; content: string }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger className="underline decoration-dotted">
          {label}
        </TooltipTrigger>
        <TooltipContent>{content}</TooltipContent>
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
