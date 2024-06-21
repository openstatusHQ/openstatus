"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { latencyFormatter, regionFormatter, type RegionChecker } from "./utils";

import { DataTableColumnHeader } from "../data-table/data-table-column-header";
import { StatusCodeBadge } from "../monitor/status-code-badge";

export const columns: ColumnDef<RegionChecker>[] = [
  {
    accessorKey: "region",
    cell: ({ row }) => {
      return <div>{regionFormatter(row.original.region)}</div>;
    },
    header: ({ column }) => {
      return <DataTableColumnHeader column={column} title="Region" />;
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
    id: "dns",
    header: ({ column }) => {
      return <DataTableColumnHeader column={column} title="DNS" />;
    },
    accessorFn: (row) => `${row.timing.dnsDone - row.timing.dnsStart}`,
  },
  {
    id: "connect",
    accessorFn: (row) => `${row.timing.connectDone - row.timing.connectStart}`,
    header: ({ column }) => {
      return <DataTableColumnHeader column={column} title="Connect" />;
    },
  },
  {
    id: "tls",
    accessorFn: (row) =>
      `${row.timing.tlsHandshakeDone - row.timing.tlsHandshakeStart}`,
    header: ({ column }) => {
      return <DataTableColumnHeader column={column} title="TLS" />;
    },
  },
  {
    id: "ttfb",
    accessorFn: (row) =>
      `${row.timing.firstByteDone - row.timing.firstByteStart}`,
    header: ({ column }) => {
      return <DataTableColumnHeader column={column} title="TTFB" />;
    },
  },
  {
    accessorKey: "latency",
    header: ({ column }) => {
      return <DataTableColumnHeader column={column} title="Latency" />;
    },
    cell: ({ row }) => {
      return <div>{latencyFormatter(row.original.latency)}</div>;
    },
  },
];
