"use client";

import { Badge, Button } from "@openstatus/ui";
import type { Table } from "@tanstack/react-table";
import { ChevronsDownUp } from "lucide-react";

interface DataTableCollapseButtonProps<TData> {
  table: Table<TData>;
}

export function DataTableCollapseButton<TData>({
  table,
}: DataTableCollapseButtonProps<TData>) {
  const isExpanded = Object.keys(table.getState().expanded).length;

  if (!isExpanded) return null;

  return (
    <Button variant="ghost" size="sm" onClick={() => table.resetExpanded()}>
      <ChevronsDownUp className="mr-2 h-4 w-4" />
      Collapse
      <Badge variant="secondary" className="ml-2">
        {isExpanded}
      </Badge>
    </Button>
  );
}
