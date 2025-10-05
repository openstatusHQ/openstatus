"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { type RegionChecker, latencyFormatter, regionFormatter } from "./utils";

import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { IconCloudProvider } from "@/components/icon-cloud-provider";
import { cn } from "@/lib/utils";
import {
  HoverCard,
  HoverCardContent,
  HoverCardPortal,
  HoverCardTrigger,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@openstatus/ui";
import { regionDict } from "@openstatus/utils";

export const columns: ColumnDef<RegionChecker>[] = [
  {
    accessorKey: "region",
    accessorFn: (row) => row.region,
    header: "Region",
    cell: ({ row }) => {
      const region = regionDict[row.original.region];
      return (
        <div className="flex items-center gap-1.5">
          <TooltipProvider>
            <Tooltip delayDuration={0}>
              <TooltipTrigger type="button">
                <IconCloudProvider provider={region.provider} />
              </TooltipTrigger>
              <TooltipContent className="capitalize">
                {region.provider}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <div>
            <span className="font-mono">
              {row.original.region.replace(/(koyeb_|railway_|fly_)/g, "")}
            </span>{" "}
            <span className="text-muted-foreground">
              {regionFormatter(row.original.region, "long")}
            </span>
          </div>
        </div>
      );
    },
    filterFn: (row, _id, filterValue) => {
      const region = regionFormatter(row.original.region, "long").toLowerCase();
      const continent =
        regionDict[row.original.region].continent.toLocaleLowerCase();
      const provider =
        regionDict[row.original.region].provider.toLocaleLowerCase();
      return `${region} ${continent} ${provider}`.includes(
        filterValue.toLowerCase(),
      );
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const statusCode = row.original.status;
      const yellow = String(statusCode).startsWith("1");
      const green = String(statusCode).startsWith("2");
      const blue = String(statusCode).startsWith("3");
      const rose =
        String(statusCode).startsWith("4") ||
        String(statusCode).startsWith("5");
      return (
        <div
          className={cn("font-mono", {
            "text-green-500": green,
            "text-blue-500": blue,
            "text-rose-500": rose,
            "text-yellow-500": yellow,
          })}
        >
          {statusCode}
        </div>
      );
    },
  },
  {
    id: "DNS",
    header: ({ column }) => {
      return (
        <DataTableColumnHeader
          column={column}
          title="DNS"
          className="pr-0 text-right"
        />
      );
    },
    accessorFn: (row) => `${row.timing.dnsDone - row.timing.dnsStart}`,
    cell: ({ row, column }) => {
      return (
        <div className="text-right font-mono text-muted-foreground">
          {latencyFormatter(row.getValue(column.id))}
        </div>
      );
    },
    meta: {
      headerClassName: "text-right",
    },
  },
  {
    id: "connect",
    accessorFn: (row) => `${row.timing.connectDone - row.timing.connectStart}`,
    header: ({ column }) => {
      return (
        <DataTableColumnHeader
          column={column}
          title="Connect"
          className="pr-0 text-right"
        />
      );
    },
    cell: ({ row, column }) => {
      return (
        <div className="text-right font-mono text-muted-foreground">
          {latencyFormatter(row.getValue(column.id))}
        </div>
      );
    },
    meta: {
      headerClassName: "text-right",
    },
  },
  {
    id: "TLS",
    accessorFn: (row) =>
      `${row.timing.tlsHandshakeDone - row.timing.tlsHandshakeStart}`,
    header: ({ column }) => {
      return (
        <DataTableColumnHeader
          column={column}
          title="TLS"
          className="pr-0 text-right"
        />
      );
    },
    cell: ({ row, column }) => {
      return (
        <div className="text-right font-mono text-muted-foreground">
          {latencyFormatter(row.getValue(column.id))}
        </div>
      );
    },
    meta: {
      headerClassName: "text-right",
    },
  },
  {
    id: "TTFB",
    accessorFn: (row) =>
      `${row.timing.firstByteDone - row.timing.firstByteStart}`,
    header: ({ column }) => {
      return (
        <DataTableColumnHeader
          column={column}
          title="TTFB"
          className="pr-0 text-right"
        />
      );
    },
    cell: ({ row, column }) => {
      return (
        <div className="text-right font-mono text-muted-foreground">
          {latencyFormatter(row.getValue(column.id))}
        </div>
      );
    },
    meta: {
      headerClassName: "text-right",
    },
  },
  {
    accessorKey: "transfer",
    accessorFn: (row) =>
      `${row.timing.transferDone - row.timing.transferStart}`,
    header: ({ column }) => {
      return (
        <DataTableColumnHeader
          column={column}
          title="Transfer"
          className="pr-0 text-right"
        />
      );
    },
    cell: ({ row, column }) => {
      return (
        <div className="text-right font-mono text-muted-foreground">
          {latencyFormatter(row.getValue(column.id))}
        </div>
      );
    },
    meta: {
      headerClassName: "text-right",
    },
  },
  {
    accessorKey: "latency",
    header: ({ column }) => {
      return (
        <DataTableColumnHeader
          column={column}
          title="Latency"
          className="pr-0 text-right"
        />
      );
    },
    cell: ({ row }) => {
      return (
        <div className="text-right font-mono">
          {latencyFormatter(row.original.latency)}
        </div>
      );
    },
    meta: {
      headerClassName: "text-right",
    },
  },
  // {
  //   accessorKey: "timing",
  //   header: "Timing",
  //   cell: ({ row }) => {
  //     return <HoverCardTiming timing={row.original.timing} />;
  //   },
  //   meta: {
  //     headerClassName: "text-right",
  //   },
  // },
];

function HoverCardTiming({
  timing: rawTiming,
}: {
  timing: NonNullable<Extract<RegionChecker, { type: "http" }>["timing"]>;
}) {
  const timing = getTiming(rawTiming);
  const total = getTotal(timing);
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
                width: `${(value / total) * 100}%`,
                backgroundColor: `hsl(var(--chart-${index + 1}))`,
              }}
            />
          ))}
        </div>
      </HoverCardTrigger>
      {/* REMINDER: allows us to port the content to the document.body, which is helpful when using opacity-50 on the row element */}
      <HoverCardPortal>
        <HoverCardContent side="bottom" align="end" className="z-10 w-auto p-2">
          <HoverCardTimingContent timing={rawTiming} />
        </HoverCardContent>
      </HoverCardPortal>
    </HoverCard>
  );
}

function HoverCardTimingContent({
  timing: rawTiming,
}: {
  timing: NonNullable<Extract<RegionChecker, { type: "http" }>["timing"]>;
}) {
  const timing = getTiming(rawTiming);
  const total = getTotal(timing);
  return (
    <div className="flex flex-col gap-1">
      {Object.entries(timing).map(([key, value], index) => {
        return (
          <div key={key} className="grid grid-cols-2 gap-4 text-xs">
            <div className="flex items-center gap-2">
              <div
                className={cn("h-2 w-2 rounded-full")}
                style={{ backgroundColor: `hsl(var(--chart-${index + 1}))` }}
              />
              <div className="font-mono text-accent-foreground uppercase">
                {key}
              </div>
            </div>
            <div className="flex items-center justify-between gap-4">
              <div className="font-mono text-muted-foreground">
                {`${new Intl.NumberFormat("en-US", {
                  maximumFractionDigits: 2,
                }).format((value / total) * 100)}%`}
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

function getTotal(timing: ReturnType<typeof getTiming>) {
  return Object.values(timing).reduce((acc, curr) => acc + curr, 0);
}

function getTiming(
  timing: NonNullable<Extract<RegionChecker, { type: "http" }>["timing"]>,
) {
  return {
    dns: timing.dnsDone - timing.dnsStart,
    connect: timing.connectDone - timing.connectStart,
    tls: timing.tlsHandshakeDone - timing.tlsHandshakeStart,
    ttfb: timing.firstByteDone - timing.firstByteStart,
    transfer: timing.transferDone - timing.transferStart,
  };
}
