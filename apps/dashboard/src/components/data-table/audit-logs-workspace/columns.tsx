"use client";

import { cn } from "@/lib/utils";
import type { RouterOutputs } from "@openstatus/api";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@openstatus/ui/components/ui/avatar";
import { Badge } from "@openstatus/ui/components/ui/badge";
import type { ColumnDef } from "@tanstack/react-table";
import { TableCellDate } from "../table-cell-date";

type AuditLog = RouterOutputs["auditLog"]["list"][number];

function getActionBadgeColor(action: string) {
  if (action.endsWith(".create"))
    return "bg-success/10 text-success border-success/20";
  if (action.endsWith(".update")) return "bg-info/10 text-info border-info/20";
  if (action.endsWith(".delete"))
    return "bg-destructive/10 text-destructive border-destructive/20";
  return "bg-muted/10 text-muted-foreground border-muted/20";
}

export const columns: ColumnDef<AuditLog>[] = [
  {
    accessorKey: "user",
    header: "Actor",
    enableSorting: false,
    enableHiding: false,
    cell: ({ row }) => {
      const user = row.original.user;
      if (!user) return <span className="text-muted-foreground">-</span>;
      return (
        <div className="flex items-center gap-2">
          <Avatar className="size-6 rounded-md">
            <AvatarImage src={user.photoUrl ?? undefined} />
            <AvatarFallback className="rounded-lg uppercase">
              {user?.name?.slice(0, 2)}
            </AvatarFallback>
          </Avatar>
          <span className="truncate font-commit-mono text-xs tracking-tight">
            {user.email}
          </span>
        </div>
      );
    },
  },
  {
    accessorKey: "action",
    header: "Action",
    enableSorting: false,
    enableHiding: false,
    cell: ({ row }) => {
      const value = row.getValue("action") as string;
      return (
        <Badge
          variant="outline"
          className={cn("font-mono text-xs", getActionBadgeColor(value))}
        >
          {value}
        </Badge>
      );
    },
  },
  {
    accessorKey: "createdAt",
    header: "Timestamp",
    enableSorting: false,
    enableHiding: false,
    cell: ({ row }) => {
      const value = row.getValue("createdAt");
      return <TableCellDate value={value} className="font-mono" />;
    },
    meta: {
      headerClassName: "text-right",
      cellClassName: "text-right",
    },
  },
];
