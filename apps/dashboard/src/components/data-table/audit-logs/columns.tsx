"use client";

import { AuditLog } from "@/data/audit-logs";
import { config } from "@/data/audit-logs.client";
import { ColumnDef } from "@tanstack/react-table";
import { cn } from "@/lib/utils";
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
        <div className="flex gap-2 flex-wrap">
          {Object.entries(value).map(([key, value]) => (
            <Pill key={key} label={key} value={String(value)} />
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
        return <div className="font-mono">{value.toLocaleString()}</div>;
      }
      return <div className="font-mono">{String(value)}</div>;
    },
  },
];

function Pill({ label, value }: { label: string; value: string }) {
  return (
    <div className="inline-flex items-center justify-center rounded-md border text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-[color,box-shadow] overflow-hidden">
      <div className="pl-2 pr-1 py-0.5 bg-muted text-foreground/70 border-r">
        {label}
      </div>
      <div className="pl-1 pr-2 py-0.5 font-mono">{value}</div>
    </div>
  );
}
