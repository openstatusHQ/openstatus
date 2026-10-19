"use client";

import type { RouterOutputs } from "@openstatus/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Row } from "@tanstack/react-table";

import { QuickActions } from "@/components/dropdowns/quick-actions";
import { useTRPC } from "@/lib/trpc/client";

type Invitation = RouterOutputs["invitation"]["list"][number];

interface DataTableRowActionsProps {
  row: Row<Invitation>;
}

export function DataTableRowActions({ row }: DataTableRowActionsProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const deleteInvitationMutation = useMutation(
    trpc.invitation.delete.mutationOptions({
      onSuccess: () =>
        queryClient.invalidateQueries({
          queryKey: trpc.invitation.list.queryKey(),
        }),
    }),
  );

  return (
    <div className="flex justify-end">
      <QuickActions
        deleteAction={{
          confirmationValue: row.original.email ?? "invitation",
          submitAction: async () => {
            await deleteInvitationMutation.mutateAsync({ id: row.original.id });
          },
        }}
      />
    </div>
  );
}
