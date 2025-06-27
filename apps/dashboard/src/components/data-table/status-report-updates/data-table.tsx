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
import { useTRPC } from "@/lib/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { colors } from "@/data/status-report-updates.client";
import { ProcessMessage } from "@/components/content/process-message";

type StatusReportUpdates =
  RouterOutputs["statusReport"]["list"][number]["updates"];

export function DataTable({
  updates,
  reportId,
}: {
  updates: StatusReportUpdates;
  reportId: number;
}) {
  const trpc = useTRPC();
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const createStatusReportUpdateMutation = useMutation(
    trpc.statusReport.createStatusReportUpdate.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.statusReport.list.queryKey({ pageId: parseInt(id) }),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.page.list.queryKey(),
        });
      },
    })
  );

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
            <FormSheetStatusReportUpdate
              onSubmit={async (values) => {
                await createStatusReportUpdateMutation.mutateAsync({
                  statusReportId: reportId,
                  message: values.message,
                  status: values.status,
                  date: values.date,
                });
              }}
            >
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
                <div className="text-wrap">
                  <ProcessMessage value={update.message} />
                </div>
              </TableCell>
              <TableCell className="w-[170px] text-muted-foreground">
                {update.date.toLocaleString()}
              </TableCell>
              <TableCell className="w-8">
                <DataTableRowActions row={update} />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
