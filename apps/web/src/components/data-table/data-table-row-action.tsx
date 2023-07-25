"use client";

import type { Row } from "@tanstack/react-table";
import { MoreHorizontal } from "lucide-react";
import * as z from "zod";

import { tbBuildResponseList } from "@openstatus/tinybird";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// REMINDER: needed because `ResponseList` returns metadata as string, not as Record
const schema = tbBuildResponseList.extend({
  metadata: z.record(z.string(), z.unknown()).nullable(),
});

interface DataTableRowActionsProps<TData> {
  row: Row<TData>;
}

export function DataTableRowActions<TData>({
  row,
}: DataTableRowActionsProps<TData>) {
  const ping = schema.parse(row.original);
  return (
    <Dialog>
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
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DialogTrigger asChild>
            <DropdownMenuItem>View Metadata</DropdownMenuItem>
          </DialogTrigger>
        </DropdownMenuContent>
      </DropdownMenu>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Metadata</DialogTitle>
          <DialogDescription>
            Additional informations to your Response like...
          </DialogDescription>
        </DialogHeader>
        <div className="border-border rounded-lg border border-dashed p-4">
          {!Boolean(Object.keys(ping.metadata || {}).length) ? (
            <ul className="grid gap-1">
              {Object.keys(ping.metadata || {}).map((key) => {
                return (
                  <li key={key} className="text-sm">
                    <p>
                      <code>
                        {`"${key}"`}: {`${ping.metadata?.[key] || null}`}
                      </code>
                    </p>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm">No data collected</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
