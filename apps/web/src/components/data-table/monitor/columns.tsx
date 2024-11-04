"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { formatDistanceToNowStrict } from "date-fns";
import Link from "next/link";

import type {
  Incident,
  Maintenance,
  Monitor,
  MonitorTag,
} from "@openstatus/db/src/schema";
import { Tracker } from "@openstatus/tracker";
import {
  Badge,
  Checkbox,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@openstatus/ui";

import { StatusDotWithTooltip } from "@/components/monitor/status-dot-with-tooltip";
import { TagBadgeWithTooltip } from "@/components/monitor/tag-badge-with-tooltip";
import { Bar } from "@/components/tracker/tracker";
import { isActiveMaintenance } from "@/lib/maintenances/utils";

import type { ResponseStatusTracker, ResponseTimeMetrics } from "@/lib/tb";
import { Eye, EyeOff, Radio, View } from "lucide-react";
import type { ReactNode } from "react";
import { DataTableColumnHeader } from "./data-table-column-header";
import { DataTableRowActions } from "./data-table-row-actions";

// EXAMPLE: get the type of the response of the endpoint

export const columns: ColumnDef<{
  monitor: Monitor;
  metrics?: ResponseTimeMetrics;
  data?: ResponseStatusTracker[];
  incidents?: Incident[];
  maintenances?: Maintenance[];
  tags?: MonitorTag[];
}>[] = [
  {
    id: "id",
    accessorKey: "id",
    accessorFn: (row) => row.monitor.id,
  },
  {
    id: "jobType",
    accessorKey: "jobType",
    accessorFn: (row) => row.monitor.jobType,
    filterFn: (row, _id, value) => {
      if (!Array.isArray(value)) return true;
      return value.includes(row.original.monitor.jobType);
    },
  },
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && "indeterminate")
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
        className="translate-y-[2px]"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
        className="translate-y-[2px]"
      />
    ),
  },
  {
    accessorKey: "active",
    accessorFn: (row) => row.monitor.active,
    header: () => <Radio className="h-4 w-4" />,
    cell: ({ row }) => {
      const { active, status } = row.original.monitor;
      const maintenance = isActiveMaintenance(row.original.maintenances);
      return (
        <div className="flex w-4 items-center justify-center">
          <StatusDotWithTooltip
            active={active}
            status={status}
            maintenance={maintenance}
          />
        </div>
      );
    },
    filterFn: (row, _id, value) => {
      if (!Array.isArray(value)) return true;
      return value.includes(row.original.monitor.active);
    },
    meta: {
      headerClassName: "w-4",
    },
  },
  {
    accessorKey: "name",
    accessorFn: (row) => row.monitor.name, // used for filtering as name is nested within the monitor object
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Name" />
    ),
    cell: ({ row }) => {
      const { name, public: _public } = row.original.monitor;
      return (
        <div className="flex gap-2">
          <Link
            href={`./monitors/${row.original.monitor.id}/overview`}
            className="group flex max-w-full items-center gap-2"
            prefetch={false}
          >
            <span className="truncate group-hover:underline">{name}</span>
          </Link>
          {_public ? <Badge variant="secondary">public</Badge> : null}
        </div>
      );
    },
  },
  {
    accessorKey: "tags",
    header: "Tags",
    cell: ({ row }) => {
      const { tags } = row.original;
      if (!tags?.length)
        return <span className="text-muted-foreground">-</span>;
      return <TagBadgeWithTooltip tags={tags} />;
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
    accessorKey: "public",
    accessorFn: (row) => row.monitor.public,
    header: () => (
      <div className="w-4">
        <View className="h-4 w-4" />
      </div>
    ),
    cell: ({ row }) => {
      const { public: _public } = row.original.monitor;
      return (
        <>
          {_public ? (
            <Eye className="h-4 w-4" />
          ) : (
            <EyeOff className="h-4 w-4" />
          )}
        </>
      );
    },
    filterFn: (row, _id, value) => {
      if (!Array.isArray(value)) return true;
      return value.includes(row.original.monitor.public);
    },
  },
  {
    accessorKey: "tracker",
    header: () => (
      <HeaderTooltip text="UTC time period">
        <span className="underline decoration-dotted">Last 7 days</span>
      </HeaderTooltip>
    ),
    cell: ({ row }) => {
      const tracker = new Tracker({
        data: row.original.data?.slice(0, 7).reverse(),
        incidents: row.original.incidents,
        maintenances: row.original.maintenances,
      });
      return (
        <div className="flex w-24 gap-1">
          {tracker.days?.map((tracker) => (
            <Bar
              key={tracker.day}
              className="h-5"
              showValues={true}
              {...tracker}
            />
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
          <div className="flex max-w-[84px] text-muted-foreground sm:max-w-none">
            <span className="truncate">{distance}</span>
          </div>
        );
      }
      return <span className="text-muted-foreground">-</span>;
    },
  },
  {
    accessorKey: "uptime",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Uptime" />
    ),
    cell: ({ row }) => {
      const { count, ok } = row.original?.metrics || {};
      if (!count || !ok)
        return <span className="text-muted-foreground">-</span>;
      const rounded = Math.round((ok / count) * 10_000) / 100;
      return <DisplayNumber value={rounded} suffix="%" />;
    },
    sortingFn: (rowA, rowB, columnId) => {
      const valueA = rowA.getValue(columnId) as number | undefined;
      const valueB = rowB.getValue(columnId) as number | undefined;
      if (!valueB) return valueA || 1;
      if (!valueA) return -valueB;
      return valueA - valueB;
    },
  },
  {
    accessorKey: "p50Latency",
    accessorFn: (row) => row.metrics?.p50Latency,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="P50" />
    ),
    cell: ({ row }) => {
      const latency = row.original.metrics?.p50Latency;
      if (latency) return <DisplayNumber value={latency} suffix="ms" />;
      return <span className="text-muted-foreground">-</span>;
    },
    sortingFn: (rowA, rowB, columnId) => {
      const valueA = rowA.getValue(columnId) as number | undefined;
      const valueB = rowB.getValue(columnId) as number | undefined;
      if (!valueB) return valueA || 1;
      if (!valueA) return -valueB;
      return valueA - valueB;
    },
  },
  {
    accessorKey: "p75Latency",
    accessorFn: (row) => row.metrics?.p75Latency,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="P75" />
    ),
    cell: ({ row }) => {
      const latency = row.original.metrics?.p75Latency;
      if (latency) return <DisplayNumber value={latency} suffix="ms" />;
      return <span className="text-muted-foreground">-</span>;
    },
    sortingFn: (rowA, rowB, columnId) => {
      const valueA = rowA.getValue(columnId) as number | undefined;
      const valueB = rowB.getValue(columnId) as number | undefined;
      if (!valueB) return valueA || 1;
      if (!valueA) return -valueB;
      return valueA - valueB;
    },
  },
  {
    accessorKey: "p95Latency",
    accessorFn: (row) => row.metrics?.p95Latency,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="P95" />
    ),
    cell: ({ row }) => {
      const latency = row.original.metrics?.p95Latency;
      if (latency) return <DisplayNumber value={latency} suffix="ms" />;
      return <span className="text-muted-foreground">-</span>;
    },
    sortingFn: (rowA, rowB, columnId) => {
      const valueA = rowA.getValue(columnId) as number | undefined;
      const valueB = rowB.getValue(columnId) as number | undefined;
      if (!valueB) return valueA || 1;
      if (!valueA) return -valueB;
      return valueA - valueB;
    },
  },
  {
    accessorKey: "p99Latency",
    accessorFn: (row) => row.metrics?.p99Latency,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="P99" />
    ),
    cell: ({ row }) => {
      const latency = row.original.metrics?.p99Latency;
      if (latency) return <DisplayNumber value={latency} suffix="ms" />;
      return <span className="text-muted-foreground">-</span>;
    },
    sortingFn: (rowA, rowB, columnId) => {
      const valueA = rowA.getValue(columnId) as number | undefined;
      const valueB = rowB.getValue(columnId) as number | undefined;
      if (!valueB) return valueA || 1;
      if (!valueA) return -valueB;
      return valueA - valueB;
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

function HeaderTooltip({
  text,
  children,
}: {
  text: string;
  children: ReactNode;
}) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger suppressHydrationWarning>{children}</TooltipTrigger>
        <TooltipContent>{text}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function DisplayNumber({ value, suffix }: { value: number; suffix: string }) {
  return (
    <span className="font-mono">
      {new Intl.NumberFormat("us").format(value).toString()}
      <span className="font-normal text-muted-foreground text-xs">
        {suffix}
      </span>
    </span>
  );
}
