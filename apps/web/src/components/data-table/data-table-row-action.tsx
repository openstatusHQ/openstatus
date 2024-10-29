"use client";

import type { Row } from "@tanstack/react-table";
import { MoreHorizontal } from "lucide-react";
import Link from "next/link";

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@openstatus/ui";
import { z } from "zod";

interface DataTableRowActionsProps<TData> {
  row: Row<TData>;
}

export function DataTableRowActions<TData>({
  row,
}: DataTableRowActionsProps<TData>) {
  // FIXME: DRY - this is a duplicate of the OSTinybird endpoint
  const ping = z
    .object({
      monitorId: z.string(),
      cronTimestamp: z.number(),
      region: z.string(),
    })
    .parse(row.original);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-8 w-8 p-0 data-[state=open]:bg-accent"
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
