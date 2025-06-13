"use client";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { icons } from "@/data/icons";
import { statusReports } from "@/data/status-reports";
import { cn } from "@/lib/utils";
import { DataTableRowActions } from "./data-table-row-actions";
import { Plus } from "lucide-react";
import { FormSheetStatusReportUpdate } from "@/components/forms/status-report-update/sheet";

const colors = {
  operational: "text-success/80",
  investigating: "text-destructive/80",
};

// TODO: move to columns.tsx and use tanstack table

export function DataTable() {
  return (
    <Table className="w-full">
      <TableHeader>
        <TableRow>
          <TableHead className="w-7">
            <span className="sr-only">Status</span>
          </TableHead>
          <TableHead>Message</TableHead>
          <TableHead>Date</TableHead>
          <TableHead className="w-[px]">
            <FormSheetStatusReportUpdate>
              <Button
                variant="ghost"
                size="icon"
                className="ml-auto flex h-7 w-7 p-0"
              >
                <Plus />
                <span className="sr-only">Create Status Report Update</span>
              </Button>
            </FormSheetStatusReportUpdate>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {statusReports[0].updates.map((update) => {
          const Icon = icons.status[update.status];
          return (
            <TableRow key={update.id}>
              <TableCell>
                <div className="p-1">
                  <Icon className={cn(colors[update.status])} size={20} />
                </div>
              </TableCell>
              <TableCell>
                <p className="text-wrap">{update.message}</p>
              </TableCell>
              <TableCell className="w-[170px] text-muted-foreground">
                {update.date.toLocaleString()}
              </TableCell>
              <TableCell className="w-8">
                <DataTableRowActions />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
