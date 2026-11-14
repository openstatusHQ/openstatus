"use client";

import type { RouterOutputs } from "@openstatus/api";
import { formatSlaUptime } from "@openstatus/db/src/schema/monitor_sla_policies/constants";
import type { ColumnDef } from "@tanstack/react-table";

import { StatusBadge } from "@/components/common/status-badge";
import { formatSlaCoverage } from "@/data/reportings.client";

import { TableCellEmpty } from "../table-cell-empty";
import { TableCellText } from "../table-cell-text";

type ReportMonitor =
  RouterOutputs["monitorReporting"]["report"]["monitors"][number];

function Mono({ children }: { children: React.ReactNode }) {
  return (
    <span className="block text-right font-mono tabular-nums">{children}</span>
  );
}

export function getColumns({
  credits,
}: {
  /** the month's terms carry a credit schedule */
  credits: boolean;
}): ColumnDef<ReportMonitor>[] {
  return [
    {
      accessorKey: "name",
      header: "Monitor",
      cell: ({ row }) => (
        <TableCellText value={row.original.name} className="font-medium" />
      ),
      meta: { cellClassName: "max-w-56 min-w-36 whitespace-normal" },
    },
    {
      id: "result",
      header: "Result",
      cell: ({ row }) => {
        const { met } = row.original;
        if (met === null) return <TableCellEmpty>—</TableCellEmpty>;
        return (
          <StatusBadge variant={met ? "success" : "destructive"}>
            {met ? "Met" : "Missed"}
          </StatusBadge>
        );
      },
    },
    {
      id: "uptime",
      header: "Uptime",
      cell: ({ row }) => (
        <Mono>
          {row.original.uptime === null
            ? "—"
            : `${formatSlaUptime(row.original.uptime)}%`}
        </Mono>
      ),
      meta: { headerClassName: "text-right" },
    },
    {
      id: "coverage",
      header: "Measured",
      cell: ({ row }) => (
        <Mono>
          {row.original.coverage === null
            ? "—"
            : `${formatSlaCoverage(row.original.coverage)}%`}
        </Mono>
      ),
      meta: { headerClassName: "text-right" },
    },
    ...(credits
      ? [
          {
            id: "credit",
            header: "Credit, this monitor",
            cell: ({ row }) => (
              <Mono>
                {row.original.credit
                  ? `${row.original.credit.pct}% of fees`
                  : "—"}
              </Mono>
            ),
            meta: { headerClassName: "text-right" },
          } satisfies ColumnDef<ReportMonitor>,
        ]
      : []),
  ];
}
