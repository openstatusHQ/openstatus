"use client";

import type { RouterOutputs } from "@openstatus/api";
import { buildCurlCommand } from "@openstatus/utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Row } from "@tanstack/react-table";
import { isTRPCClientError } from "@trpc/client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { ExportCodeDialog } from "@/components/dialogs/export-code";
import { QuickActions } from "@/components/dropdowns/quick-actions";
import { getActions } from "@/data/monitors.client";
import { useTRPC } from "@/lib/trpc/client";

type Monitor = RouterOutputs["monitor"]["list"][number];
interface DataTableRowActionsProps {
  row: Row<Monitor>;
}

export function DataTableRowActions({ row }: DataTableRowActionsProps) {
  const [openDialog, setOpenDialog] = useState(false);
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const deleteMonitorMutation = useMutation(
    trpc.monitor.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(trpc.monitor.list.queryOptions());
      },
    }),
  );
  const updateMonitorsMutation = useMutation(
    trpc.monitor.updateMonitors.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(trpc.monitor.list.queryOptions());
      },
    }),
  );
  const router = useRouter();

  function setActive(active: boolean) {
    const promise = updateMonitorsMutation.mutateAsync({
      ids: [row.original.id],
      active,
    });
    toast.promise(promise, {
      loading: active ? "Resuming monitor..." : "Pausing monitor...",
      success: active ? "Monitor resumed" : "Monitor paused",
      error: (error) => {
        if (isTRPCClientError(error)) {
          return error.message;
        }
        return active ? "Failed to resume monitor" : "Failed to pause monitor";
      },
    });
  }
  // curl only speaks HTTP — the action is hidden for tcp/dns monitors
  const isHttp = row.original.jobType === "http";
  const hiddenAction = row.original.active ? "resume" : "pause";
  const actions = getActions({
    edit: () => router.push(`/monitors/${row.original.id}/edit`),
    pause: () => setActive(false),
    resume: () => setActive(true),
    "copy-id": () => {
      navigator.clipboard.writeText(row.original.id.toString());
      toast.success("Monitor ID copied to clipboard");
    },
    "copy-curl": isHttp
      ? async () => {
          await navigator.clipboard.writeText(buildCurlCommand(row.original));
          toast.success("cURL command copied to clipboard");
        }
      : undefined,
    // export: () => setOpenDialog(true),
  }).filter(
    (action) =>
      action.id !== hiddenAction && (action.id !== "copy-curl" || isHttp),
  );

  return (
    <>
      <QuickActions
        actions={actions}
        deleteAction={{
          confirmationValue: row.original.name ?? "monitor",
          submitAction: async () => {
            await deleteMonitorMutation.mutateAsync({
              id: row.original.id,
            });
          },
        }}
      />
      <ExportCodeDialog open={openDialog} onOpenChange={setOpenDialog} />
    </>
  );
}
