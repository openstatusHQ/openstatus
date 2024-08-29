"use client";

import type { ColumnDef } from "@tanstack/react-table";
import {
  type RegionChecker,
  continentFormatter,
  latencyFormatter,
  regionFormatter,
  timestampFormatter,
} from "./utils";

import { format } from "date-fns";
import { utcToZonedTime } from "date-fns-tz";
import { DataTableColumnHeader } from "../data-table/data-table-column-header";
import { StatusCodeBadge } from "../monitor/status-code-badge";

export const columns: ColumnDef<RegionChecker>[] = [
  {
    id: "key",
    accessorFn: (row) => row.region,
    header: "Key",
    cell: ({ row }) => {
      return <div className="font-mono">{row.original.region}</div>;
    },
    enableHiding: false,
  },
  {
    accessorKey: "region",
    header: "Region",
    cell: ({ row }) => {
      return (
        <div className="text-muted-foreground">
          {regionFormatter(row.original.region, "long")}
        </div>
      );
    },
  },
  {
    id: "continent",
    accessorFn: (row) => continentFormatter(row.region),
    header: ({ column }) => {
      return <DataTableColumnHeader column={column} title="Continent" />;
    },
    cell: ({ row }) => {
      return <div>{row.getValue("continent")}</div>;
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      return <StatusCodeBadge statusCode={row.original.status} />;
    },
  },
  {
    id: "DNS",
    header: ({ column }) => {
      return <DataTableColumnHeader column={column} title="DNS" />;
    },
    accessorFn: (row) => `${row.timing.dnsDone - row.timing.dnsStart}`,
    cell: ({ row, column }) => {
      return (
        <div className="font-mono">
          {latencyFormatter(row.getValue(column.id))}
        </div>
      );
    },
  },
  {
    id: "connect",
    accessorFn: (row) => `${row.timing.connectDone - row.timing.connectStart}`,
    header: ({ column }) => {
      return <DataTableColumnHeader column={column} title="Connect" />;
    },
    cell: ({ row, column }) => {
      return (
        <div className="font-mono">
          {latencyFormatter(row.getValue(column.id))}
        </div>
      );
    },
  },
  {
    id: "TLS",

    accessorFn: (row) =>
      `${row.timing.tlsHandshakeDone - row.timing.tlsHandshakeStart}`,
    header: ({ column }) => {
      return <DataTableColumnHeader column={column} title="TLS" />;
    },
    cell: ({ row, column }) => {
      return (
        <div className="font-mono">
          {latencyFormatter(row.getValue(column.id))}
        </div>
      );
    },
  },
  {
    id: "TTFB",
    accessorFn: (row) =>
      `${row.timing.firstByteDone - row.timing.firstByteStart}`,
    header: ({ column }) => {
      return <DataTableColumnHeader column={column} title="TTFB" />;
    },
    cell: ({ row, column }) => {
      return (
        <div className="font-mono">
          {latencyFormatter(row.getValue(column.id))}
        </div>
      );
    },
  },
  {
    accessorKey: "latency",
    header: ({ column }) => {
      return <DataTableColumnHeader column={column} title="Latency" />;
    },
    cell: ({ row }) => {
      return (
        <div className="font-mono">
          {latencyFormatter(row.original.latency)}
        </div>
      );
    },
  },
  {
    id: "Time (UTC)",
    accessorFn: (row) => row.time,
    cell: ({ row }) => {
      const date = format(
        utcToZonedTime(row.original.time, "UTC"),
        "dd LLL hh:mm a",
      );

      return <div className="whitespace-nowrap">{date}</div>;
    },
  },
];
