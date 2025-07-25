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
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@openstatus/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { isTRPCClientError } from "@trpc/client";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";

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
  const [open, setOpen] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();
  const [value, setValue] = React.useState("");
  const rows = table.getFilteredSelectedRowModel().rows;
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const deleteMonitorsMutation = useMutation(
    trpc.monitor.deleteMonitors.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.monitor.list.queryKey(),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.workspace.get.queryKey(),
        });
        // Clear selection once deletion succeeds
        table.toggleAllRowsSelected(false);
      },
    }),
  );

  const updateMonitorsMutation = useMutation(
    trpc.monitor.updateMonitors.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.monitor.list.queryKey(),
        });
      },
    }),
  );

  const confirmationValue = React.useMemo(
    () => `delete monitor${rows.length === 1 ? "" : "s"}`,
    [rows.length],
  );

  const handleDelete = async () => {
    try {
      startTransition(async () => {
        const promise = deleteMonitorsMutation.mutateAsync({
          ids: rows.map((row) => row.original.id),
        });
        toast.promise(promise, {
          loading: "Deleting...",
          success: "Deleted",
          error: (error) => {
            if (isTRPCClientError(error)) {
              return error.message;
            }
            return "Failed to delete";
          },
        });
        await promise;
        setOpen(false);
      });
    } catch (error) {
      console.error("Failed to delete:", error);
    }
  };

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
              },
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
        <AlertDialog open={open} onOpenChange={setOpen}>
          <AlertDialogTrigger asChild>
            <DataTableActionBarAction
              size="icon"
              tooltip="Delete monitors"
              isPending={isPending || deleteMonitorsMutation.isPending}
            >
              <Trash2 />
            </DataTableActionBarAction>
          </AlertDialogTrigger>
          <AlertDialogContent
            onCloseAutoFocus={(event) => {
              // Work-around: body becomes unclickable after closing the dialog
              event.preventDefault();
              document.body.style.pointerEvents = "";
            }}
          >
            <AlertDialogHeader>
              <AlertDialogTitle>
                Delete {rows.length} monitor{rows.length > 1 ? "s" : ""}?
              </AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently remove the
                selected monitor(s) from the database.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <form id="form-alert-dialog" className="space-y-0.5">
              <p className="text-muted-foreground text-xs">
                Please write &apos;
                <span className="font-semibold">{confirmationValue}</span>
                &apos; to confirm
              </p>
              <Input value={value} onChange={(e) => setValue(e.target.value)} />
            </form>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={(e) => e.stopPropagation()}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-white shadow-xs hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:bg-destructive/60 dark:focus-visible:ring-destructive/40"
                disabled={value !== confirmationValue || isPending}
                form="form-alert-dialog"
                type="submit"
                onClick={(e) => {
                  e.preventDefault();
                  handleDelete();
                }}
              >
                {isPending ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DataTableActionBar>
  );
}
