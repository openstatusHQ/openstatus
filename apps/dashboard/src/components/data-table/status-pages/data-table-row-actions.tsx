"use client";

import { QuickActions } from "@/components/dropdowns/quick-actions";
import { getActions } from "@/data/status-pages.client";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@openstatus/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Row } from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

type StatusPage = RouterOutputs["page"]["list"][number];

interface DataTableRowActionsProps {
  row: Row<StatusPage>;
}

export function DataTableRowActions({ row }: DataTableRowActionsProps) {
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const deleteStatusPageMutation = useMutation(
    trpc.page.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.page.list.queryKey(),
        });
      },
    }),
  );
  const actions = getActions({
    edit: () => router.push(`/status-pages/${row.original.id}/edit`),
    "copy-id": () => {
      navigator.clipboard.writeText("ID");
      toast.success("Monitor ID copied to clipboard");
    },
  });

  return (
    <QuickActions
      actions={actions}
      deleteAction={{
        title: "Status Page",
        confirmationValue: "delete status page",
        submitAction: async () => {
          await deleteStatusPageMutation.mutateAsync({
            id: row.original.id,
          });
        },
      }}
    />
  );
}
