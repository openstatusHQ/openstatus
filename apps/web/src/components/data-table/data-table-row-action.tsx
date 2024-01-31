"use client";

import Link from "next/link";
import type { Row } from "@tanstack/react-table";
import { MoreHorizontal } from "lucide-react";

import { tbBuildResponseList } from "@openstatus/tinybird";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@openstatus/ui";

interface DataTableRowActionsProps<TData> {
  row: Row<TData>;
}

export function DataTableRowActions<TData>({
  row,
}: DataTableRowActionsProps<TData>) {
  const ping = tbBuildResponseList.parse(row.original);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="data-[state=open]:bg-accent h-8 w-8 p-0"
        >
          <span className="sr-only">Open menu</span>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <Link
          href={`./details?monitorId=${ping.monitorId}&cronTimestamp=${ping.cronTimestamp}&region=${ping.region}`}
        >
          <DropdownMenuItem>Details</DropdownMenuItem>
        </Link>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
