"use client";

import { formatDate } from "@/lib/formatter";
import type { RouterOutputs } from "@openstatus/api";
import { Badge } from "@openstatus/ui/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@openstatus/ui/components/ui/tooltip";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTableRowActions } from "./data-table-row-actions";

type Subscriber = RouterOutputs["pageSubscriber"]["list"][number];

function detectFlavorBadge(url: string | null) {
  if (!url) return null;
  if (url.startsWith("https://hooks.slack.com/services/")) return "Slack";
  if (url.startsWith("https://discord.com/api/webhooks/")) return "Discord";
  return "Webhook";
}

export const columns: ColumnDef<Subscriber>[] = [
  {
    id: "destination",
    header: "Destination",
    enableSorting: false,
    enableHiding: false,
    cell: ({ row }) => {
      const sub = row.original;
      const raw = sub.channelType === "email" ? sub.email : sub.webhookUrl;
      const display = sub.name ?? raw ?? "";
      const flavor =
        sub.channelType === "webhook"
          ? detectFlavorBadge(sub.webhookUrl)
          : null;

      return (
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="max-w-[280px] truncate">{display}</span>
            </TooltipTrigger>
            {raw ? <TooltipContent>{raw}</TooltipContent> : null}
          </Tooltip>
          {flavor ? (
            <Badge variant="outline" className="text-xs">
              {flavor}
            </Badge>
          ) : null}
        </div>
      );
    },
  },
  {
    id: "source",
    accessorFn: (row) => row.source,
    header: "Source",
    enableSorting: false,
    enableHiding: false,
    filterFn: (row, id, filterValue: string[]) => {
      if (!filterValue?.length) return true;
      return filterValue.includes(row.getValue(id) as string);
    },
    cell: ({ row }) => {
      const source = row.original.source;
      const label =
        source === "vendor"
          ? "Vendor"
          : source === "import"
            ? "Import"
            : "Self-signup";
      return (
        <Badge variant="outline" className="text-xs">
          {label}
        </Badge>
      );
    },
  },
  {
    id: "components",
    header: "Components",
    enableSorting: false,
    enableHiding: false,
    cell: ({ row }) => {
      const { components, isEntirePage } = row.original;
      if (isEntirePage) {
        return (
          <span className="text-muted-foreground text-xs">Entire page</span>
        );
      }
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="text-xs">{components.length} components</span>
          </TooltipTrigger>
          <TooltipContent>
            {components.map((c) => c.name).join(", ")}
          </TooltipContent>
        </Tooltip>
      );
    },
  },
  {
    id: "status",
    accessorFn: (row) => {
      if (row.unsubscribedAt) return "unsubscribed";
      if (!row.acceptedAt) return "pending";
      return "active";
    },
    header: "Status",
    enableSorting: false,
    enableHiding: false,
    filterFn: (row, id, filterValue: string[]) => {
      if (!filterValue?.length) return true;
      return filterValue.includes(row.getValue(id) as string);
    },
    cell: ({ row }) => {
      const status = row.getValue("status") as string;
      if (status === "unsubscribed") {
        return <Badge variant="destructive">Unsubscribed</Badge>;
      }
      if (status === "pending") {
        return <Badge variant="outline">Pending</Badge>;
      }
      return <Badge variant="secondary">Active</Badge>;
    },
  },
  {
    accessorKey: "createdAt",
    header: "Created At",
    enableSorting: false,
    enableHiding: false,
    cell: ({ row }) => {
      const value = row.getValue("createdAt");
      if (value instanceof Date) return formatDate(value);
      if (!value) return "-";
      return value;
    },
    meta: {
      cellClassName: "font-mono",
    },
  },
  {
    id: "actions",
    cell: ({ row }) => <DataTableRowActions row={row} />,
    meta: {
      cellClassName: "w-8",
    },
  },
];
