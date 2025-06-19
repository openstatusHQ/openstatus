"use client";

import { FormSheetStatusReportUpdate } from "@/components/forms/status-report-update/sheet";
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
import { cn } from "@/lib/utils";
import { Plus } from "lucide-react";
import { DataTableRowActions } from "./data-table-row-actions";
import { RouterOutputs } from "@openstatus/api";

const colors = {
  investigating: "text-destructive/80",
  identified: "text-warning/80",
  monitoring: "text-info/80",
  resolved: "text-success/80",
};

type StatusReportUpdates =
  RouterOutputs["statusReport"]["list"][number]["updates"];

export function DataTable({ updates }: { updates: StatusReportUpdates }) {
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
        {updates.map((update) => {
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
