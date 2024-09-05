"use client";

import type { ColumnDef } from "@tanstack/react-table";
import {
  type RegionChecker,
  continentFormatter,
  latencyFormatter,
  regionFormatter,
} from "./utils";

import { flyRegionsDict } from "@openstatus/utils";
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
    accessorFn: (row) => row.region,
    header: "Region",
    cell: ({ row }) => {
      return (
        <div className="text-muted-foreground">
          {regionFormatter(row.original.region, "long")}
        </div>
      );
    },
    filterFn: (row, _id, filterValue) => {
      const region = regionFormatter(row.original.region, "long").toLowerCase();
      const continent =
        flyRegionsDict[row.original.region].continent.toLocaleLowerCase();
      return `${region} ${continent}`.includes(filterValue.toLowerCase());
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
        <div className="text-right font-mono">
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
        <div className="text-right font-mono">
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
        <div className="text-right font-mono">
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
        <div className="text-right font-mono">
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
        <div className="text-right font-mono">
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
];
