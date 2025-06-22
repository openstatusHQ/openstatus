"use client";

import { SelectTrigger } from "@radix-ui/react-select";
import type { Table } from "@tanstack/react-table";
import { CheckCircle2, Trash2 } from "lucide-react";
import * as React from "react";

import {
  DataTableActionBar,
  DataTableActionBarAction,
  DataTableActionBarSelection,
} from "@/components/ui/data-table/data-table-action-bar";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { RouterOutputs } from "@openstatus/api";
import { useTRPC } from "@/lib/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { isTRPCClientError } from "@trpc/client";

type Monitor = RouterOutputs["monitor"]["list"][number];

const ACTIVE = [
  { label: "active", value: true },
  { label: "inactive", value: false },
];

interface MonitorDataTableActionBarProps {
  table: Table<Monitor>;
}

export function MonitorDataTableActionBar({
  table,
}: MonitorDataTableActionBarProps) {
  const rows = table.getFilteredSelectedRowModel().rows;
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  // TODO:
  // const deleteMonitorsMutation = useMutation(
  //   trpc.monitor.deleteMonitors.mutationOptions({
  //     onSuccess: () => {
  //       queryClient.invalidateQueries({
  //         queryKey: trpc.monitor.list.queryKey(),
  //       });
  //       queryClient.invalidateQueries({
  //         queryKey: trpc.workspace.get.queryKey(),
  //       });
  //     },
  //   })
  // );

  const updateMonitorsMutation = useMutation(
    trpc.monitor.updateMonitors.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.monitor.list.queryKey(),
        });
      },
    })
  );

  return (
    <DataTableActionBar table={table} visible={rows.length > 0}>
      <DataTableActionBarSelection table={table} />
      <Separator
        orientation="vertical"
        className="hidden data-[orientation=vertical]:h-5 sm:block"
      />
      <div className="flex items-center gap-1.5">
        <Select
          onValueChange={(v) => {
            toast.promise(
              updateMonitorsMutation.mutateAsync({
                ids: rows.map((row) => row.original.id),
                active: v === "active",
              }),
              {
                loading: "Updating...",
                success: "Updated",
                error: (error) => {
                  if (isTRPCClientError(error)) {
                    return error.message;
                  }
                  return "Failed to update";
                },
              }
            );
          }}
        >
          <SelectTrigger asChild>
            <DataTableActionBarAction size="icon" tooltip="Update status">
              <CheckCircle2 />
            </DataTableActionBarAction>
          </SelectTrigger>
          <SelectContent align="center">
            <SelectGroup>
              {ACTIVE.map((status) => (
                <SelectItem
                  key={status.label}
                  value={status.label}
                  className="capitalize"
                >
                  {status.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        {/* TODO: extract the AlertDialog from QuickActions */}
        <DataTableActionBarAction size="icon" tooltip="Delete monitors">
          <Trash2 />
        </DataTableActionBarAction>
      </div>
    </DataTableActionBar>
  );
}
