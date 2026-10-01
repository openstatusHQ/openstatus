"use client";

import type { RouterOutputs } from "@openstatus/api";
import {
  type PageComponentImpact,
  worstImpact,
} from "@openstatus/db/src/schema/page_components/constants";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";

import { TableCellBadge } from "@/components/data-table/table-cell-badge";
import { TableCellDate } from "@/components/data-table/table-cell-date";
import { TableCellLink } from "@/components/data-table/table-cell-link";
import { TableCellNumber } from "@/components/data-table/table-cell-number";
import {
  StatusReportImpactBadge,
  StatusReportStatusBadge,
} from "@/components/status-reports/status-report-badge";
import { DataTableColumnHeader } from "@/components/ui/data-table/data-table-column-header";
import { reportStartedAt } from "@/data/status-reports.client";

import { DataTableRowActions } from "./data-table-row-actions";

type StatusReport = RouterOutputs["statusReport"]["list"][number];

// derived top-level impact = worst impact set by any update, not the
// current one (a resolved report would always read "Operational");
// legacy reports (no impact rows) read "Untriaged"
function worstReportImpact(report: StatusReport) {
  const impacts = report.updates.flatMap((u) =>
    u.componentImpacts.map((ci) => ci.impact),
  );
  if (impacts.length === 0) return null;
  return worstImpact(impacts);
}

export const columns: ColumnDef<StatusReport>[] = [
  {
    accessorKey: "title",
    header: "Title",
    enableSorting: false,
    enableHiding: false,
    cell: ({ row }) => {
      const { id, pageId } = row.original;
      return (
        <TableCellLink
          href={`/status-pages/${pageId}/status-reports/${id}`}
          value={row.getValue("title")}
        />
      );
    },
    meta: { cellClassName: "max-w-[200px] truncate" },
  },
  {
    id: "impact",
    accessorFn: (row) => worstReportImpact(row),
    header: "Impact",
    enableSorting: false,
    cell: ({ row }) => (
      <StatusReportImpactBadge
        impact={row.getValue<PageComponentImpact | null>("impact")}
      />
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    enableSorting: false,
    enableHiding: false,
    cell: ({ row }) => <StatusReportStatusBadge status={row.original.status} />,
  },
  {
    id: "updates",
    accessorFn: (row) => row.updates.length,
    header: "Updates",
    cell: ({ row }) => <TableCellNumber value={row.getValue("updates")} />,
  },
  {
    id: "pageComponents",
    accessorFn: (row) => row?.pageComponents,
    header: "Affected",
    cell: ({ row }) => {
      const value = row.getValue("pageComponents");
      if (Array.isArray(value) && value.length > 0 && "name" in value[0]) {
        return (
          <div className="flex flex-wrap gap-1">
            {value.map((m) =>
              m.monitorId ? (
                <Link href={`/monitors/${m.monitorId}/overview`} key={m.id}>
                  <TableCellBadge value={m.name} />
                </Link>
              ) : (
                <TableCellBadge value={m.name} key={m.id} />
              ),
            )}
          </div>
        );
      }
      return <div className="text-muted-foreground">-</div>;
    },
  },
  {
    id: "startedAt",
    accessorFn: (row) => reportStartedAt(row),
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Started At" />
    ),
    cell: ({ row }) => <TableCellDate value={row.getValue("startedAt")} />,
    enableHiding: false,
    meta: { cellClassName: "whitespace-nowrap" },
  },
  {
    id: "actions",
    cell: ({ row }) => <DataTableRowActions row={row} />,
    meta: { cellClassName: "w-8" },
  },
];
