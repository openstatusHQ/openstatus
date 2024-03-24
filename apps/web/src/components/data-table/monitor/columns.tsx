"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { formatDistanceToNowStrict } from "date-fns";
import Link from "next/link";

import type { Incident, Monitor, MonitorTag } from "@openstatus/db/src/schema";
import type {
  Monitor as MonitorTracker,
  ResponseTimeMetrics,
} from "@openstatus/tinybird";
import { Tracker } from "@openstatus/tracker";
import {
  Badge,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@openstatus/ui";

import { StatusDotWithTooltip } from "@/components/monitor/status-dot-with-tooltip";
import { TagBadge } from "@/components/monitor/tag-badge";
import { Bar } from "@/components/tracker/tracker";
import { DataTableRowActions } from "./data-table-row-actions";

export const columns: ColumnDef<{
  monitor: Monitor;
  metrics?: ResponseTimeMetrics;
  data?: MonitorTracker[];
  incidents?: Incident[];
  tags?: MonitorTag[];
}>[] = [
  {
    accessorKey: "name",
    accessorFn: (row) => row.monitor.name, // used for filtering as name is nested within the monitor object
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
    accessorKey: "tags",
    header: "Tags",
    cell: ({ row }) => {
      const { tags } = row.original;
      const [first, second, ...rest] = tags || [];
      return (
        <div className="flex gap-2">
          {first ? <TagBadge {...first} /> : null}
          {second ? <TagBadge {...second} /> : null}
          {rest.length > 0 ? <TagsTooltip tags={rest || []} /> : null}
        </div>
      );
    },
    filterFn: (row, _id, value) => {
      if (!Array.isArray(value)) return true;
      // REMINDER: if one value is found, return true
      // we could consider restricting it to all the values have to be found
      return value.some((item) =>
        row.original.tags?.some((tag) => tag.name === item),
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
      return <DisplayNumber value={rounded} suffix="%" />;
    },
  },
  {
    accessorKey: "p50Latency",
    header: () => (
      <HeaderTooltip label="P50" content="Data from the last 24h" />
    ),
    cell: ({ row }) => {
      const latency = row.original.metrics?.p50Latency;
      if (latency) return <DisplayNumber value={latency} suffix="ms" />;
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
      if (latency) return <DisplayNumber value={latency} suffix="ms" />;
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

function TagsTooltip({ tags }: { tags: MonitorTag[] }) {
  return (
    <TooltipProvider>
      <Tooltip delayDuration={200}>
        <TooltipTrigger>
          <Badge variant="secondary">+{tags.length}</Badge>
        </TooltipTrigger>
        <TooltipContent side="top" className="flex gap-2">
          {tags.map((tag) => (
            <TagBadge key={tag.id} {...tag} />
          ))}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

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

function DisplayNumber({ value, suffix }: { value: number; suffix: string }) {
  return (
    <span className="font-mono">
      {new Intl.NumberFormat("us").format(value).toString()}
      <span className="text-muted-foreground text-xs font-normal">
        {suffix}
      </span>
    </span>
  );
}
