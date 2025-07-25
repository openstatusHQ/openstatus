"use client";

import { HoverCardTimestamp } from "@/components/common/hover-card-timestamp";
import { TableCellDate } from "@/components/data-table/table-cell-date";
import { config, metadata } from "@/data/audit-logs.client";
import { cn } from "@/lib/utils";
import type { RouterOutputs } from "@openstatus/api";
import type { ColumnDef } from "@tanstack/react-table";

type AuditLog = RouterOutputs["tinybird"]["auditLog"]["data"][number];

export const columns: ColumnDef<AuditLog>[] = [
  {
    id: "icon",
    accessorFn: (row) => row.action,
    header: () => null,
    enableSorting: false,
    enableHiding: false,
    cell: ({ row }) => {
      const value = row.getValue("action");
      const { icon: Icon, color } = config[value as keyof typeof config];
      if (!Icon) return null;
      return <Icon className={cn("size-4", color)} />;
    },
    meta: {
      headerClassName: "w-7",
    },
  },
  {
    accessorKey: "action",
    header: "Action",
    enableSorting: false,
    enableHiding: false,
    cell: ({ row }) => {
      const value = row.getValue("action");
      const { title } = config[value as keyof typeof config];
      if (!title) return null;
      return <div>{title}</div>;
    },
  },
  {
    accessorKey: "metadata",
    header: "Information",
    enableSorting: false,
    enableHiding: false,
    cell: ({ row }) => {
      const value = row.getValue("metadata");
      if (!value) return null;
      return (
        <div className="flex flex-wrap gap-2">
          {Object.entries(value)
            .filter(([key, value]) =>
              metadata[key as keyof typeof metadata]?.visible(value),
            )
            .map(([key, value]) => (
              <Pill
                key={key}
                label={metadata[key as keyof typeof metadata].key}
                value={metadata[key as keyof typeof metadata]?.format(value)}
              />
            ))}
        </div>
      );
    },
  },
  {
    accessorKey: "timestamp",
    header: "Timestamp",
    enableSorting: false,
    enableHiding: false,
    cell: ({ row }) => {
      const value = row.getValue("timestamp");
      if (value instanceof Date) {
        return (
          <HoverCardTimestamp date={value}>
            <TableCellDate value={value} className="font-mono" />
          </HoverCardTimestamp>
        );
      }
      const date = new Date(Number(value));
      if (Number.isNaN(date.getTime())) {
        return <div className="font-mono">{String(value)}</div>;
      }

      return (
        <HoverCardTimestamp date={date}>
          <TableCellDate value={date} className="font-mono" />
        </HoverCardTimestamp>
      );
    },
  },
];

function Pill({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden whitespace-nowrap rounded-md border font-medium text-xs transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3">
      <div className="border-r bg-muted py-0.5 pr-1 pl-2 text-foreground/70">
        {label}
      </div>
      <div className="py-0.5 pr-2 pl-1 font-mono">
        {/* NOTE: if we have more number values, we might wanna change it */}
        {value}
      </div>
    </div>
  );
}
