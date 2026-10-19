"use client";

import type { RouterOutputs } from "@openstatus/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Row } from "@tanstack/react-table";

import { QuickActions } from "@/components/dropdowns/quick-actions";
import { useTRPC } from "@/lib/trpc/client";

type Grant = RouterOutputs["oauth"]["listGrants"][number];

interface DataTableRowActionsProps {
  row: Row<Grant>;
}

export function DataTableRowActions({ row }: DataTableRowActionsProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const revokeGrantMutation = useMutation(
    trpc.oauth.revokeGrant.mutationOptions({
      onSuccess: () =>
        queryClient.invalidateQueries({
          queryKey: trpc.oauth.listGrants.queryKey(),
        }),
    }),
  );

  return (
    <div className="flex justify-end">
      <QuickActions
        deleteAction={{
          confirmationValue: row.original.clientName,
          submitAction: async () => {
            await revokeGrantMutation.mutateAsync({ grantId: row.original.id });
          },
        }}
      />
    </div>
  );
}
