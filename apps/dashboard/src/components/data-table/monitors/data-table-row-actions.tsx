"use client";

import { ExportCodeDialog } from "@/components/dialogs/export-code";
import { QuickActions } from "@/components/dropdowns/quick-actions";
import { getActions } from "@/data/monitors.client";
import { useTRPC } from "@/lib/trpc/client";
import { RouterOutputs } from "@openstatus/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Row } from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

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
    })
  );
  const router = useRouter();
  const actions = getActions({
    edit: () => router.push(`/monitors/${row.original.id}/edit`),
    "copy-id": () => {
      navigator.clipboard.writeText("ID");
      toast.success("Monitor ID copied to clipboard");
    },
    // export: () => setOpenDialog(true),
  });

  return (
    <>
      <QuickActions
        actions={actions}
        deleteAction={{
          title: "Monitor",
          confirmationValue: "delete monitor",
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
