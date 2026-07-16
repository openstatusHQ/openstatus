"use client";

import { Button } from "@openstatus/ui/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@openstatus/ui/components/ui/tooltip";
import { cn } from "@openstatus/ui/lib/utils";
import type { ColumnDef } from "@tanstack/react-table";
import { formatDistanceStrict } from "date-fns";

import { IncidentRowActions } from "@/components/data-table/incidents/data-table-row-actions";
import { MaintenanceRowActions } from "@/components/data-table/maintenances/data-table-row-actions";
import { StatusReportRowActions } from "@/components/data-table/status-reports/data-table-row-actions";
import { TableCellDate } from "@/components/data-table/table-cell-date";
import { TableCellLink } from "@/components/data-table/table-cell-link";
import { TableCellNumber } from "@/components/data-table/table-cell-number";
import { FormSheetStatusReportUpdateCreate } from "@/components/forms/status-report-update/sheet-create";
import { DataTableColumnHeader } from "@/components/ui/data-table/data-table-column-header";
import {
  type OverviewEvent,
  eventTypeConfig,
  getIncidentStatus,
  getMaintenanceStatus,
  getResolvedAt,
  getStartedAt,
  incidentStatusConfig,
  maintenanceStatusConfig,
} from "@/data/overview-events.client";
import { colors } from "@/data/status-report-updates.client";

import { IncidentActionCell } from "./incident-action-cell";

function getStatus(event: OverviewEvent): { label: string; color: string } {
  switch (event.type) {
    case "incident":
      return incidentStatusConfig[getIncidentStatus(event.incident)];
    case "report":
      return { label: event.report.status, color: colors[event.report.status] };
    case "maintenance":
      return maintenanceStatusConfig[getMaintenanceStatus(event.maintenance)];
  }
}

function getTitle(event: OverviewEvent): { title: string; href: string } {
  switch (event.type) {
    case "incident":
      return {
        title: event.incident.monitor.name,
        href: `/monitors/${event.incident.monitor.id}/incidents`,
      };
    case "report":
      return {
        title: event.report.title,
        href: `/status-pages/${event.report.pageId}/status-reports/${event.report.id}`,
      };
    case "maintenance":
      return {
        title: event.maintenance.title,
        href: `/status-pages/${event.maintenance.pageId}/maintenances`,
      };
  }
}

function getDuration(event: OverviewEvent): string | null {
  const startedAt = getStartedAt(event);
  const resolvedAt = getResolvedAt(event);
  if (!resolvedAt) return null;
  return formatDistanceStrict(startedAt, resolvedAt);
}

export const columns: ColumnDef<OverviewEvent>[] = [
  {
    id: "type",
    accessorFn: (row) => row.type,
    header: () => null,
    cell: ({ row }) => {
      const config = eventTypeConfig[row.original.type];
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="flex items-center">
              <config.icon
                className="text-muted-foreground size-4"
                aria-hidden="true"
              />
              <span className="sr-only">{config.label}</span>
            </span>
          </TooltipTrigger>
          <TooltipContent side="left">{config.label}</TooltipContent>
        </Tooltip>
      );
    },
    enableSorting: false,
    enableHiding: false,
    meta: {
      headerClassName: "w-8",
    },
  },
  {
    id: "title",
    accessorFn: (row) => getTitle(row).title,
    header: "Title",
    cell: ({ row }) => {
      const { title, href } = getTitle(row.original);
      return <TableCellLink href={href} value={title} />;
    },
    enableSorting: false,
    enableHiding: false,
    meta: {
      cellClassName: "max-w-[200px] truncate",
    },
  },
  {
    id: "status",
    accessorFn: (row) => getStatus(row).label,
    header: "Status",
    cell: ({ row }) => {
      const { label, color } = getStatus(row.original);
      return <div className={cn("font-mono capitalize", color)}>{label}</div>;
    },
    enableSorting: false,
    enableHiding: false,
  },
  {
    id: "startedAt",
    accessorFn: (row) => getStartedAt(row),
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Start" />
    ),
    cell: ({ row }) => <TableCellDate value={row.getValue("startedAt")} />,
    enableHiding: false,
    meta: {
      cellClassName: "w-[170px]",
    },
  },
  {
    id: "endsAt",
    accessorFn: (row) => getResolvedAt(row),
    header: "End",
    cell: ({ row }) => <TableCellDate value={row.getValue("endsAt")} />,
    enableSorting: false,
    meta: {
      cellClassName: "w-[170px]",
    },
  },
  {
    id: "duration",
    accessorFn: (row) => getDuration(row),
    header: "Duration",
    cell: ({ row }) => {
      const value = row.getValue("duration");
      if (typeof value !== "string") {
        return <div className="text-muted-foreground font-mono">ongoing</div>;
      }
      const [amount, unit] = value.split(" ");
      return <TableCellNumber value={amount} unit={unit} />;
    },
    enableSorting: false,
  },
  {
    id: "action",
    header: () => null,
    cell: ({ row }) => {
      const event = row.original;
      switch (event.type) {
        case "incident":
          return <IncidentActionCell incident={event.incident} />;
        case "report":
          if (event.report.status === "resolved") return null;
          return (
            <FormSheetStatusReportUpdateCreate report={event.report}>
              <Button variant="outline" size="sm" className="h-7">
                Add Update
              </Button>
            </FormSheetStatusReportUpdateCreate>
          );
        case "maintenance":
          return null;
      }
    },
    enableSorting: false,
    meta: {
      cellClassName: "w-[110px] text-right",
    },
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const event = row.original;
      switch (event.type) {
        case "incident":
          return <IncidentRowActions incident={event.incident} />;
        case "report":
          return <StatusReportRowActions report={event.report} />;
        case "maintenance":
          return <MaintenanceRowActions maintenance={event.maintenance} />;
      }
    },
    meta: {
      cellClassName: "w-8",
    },
  },
];
