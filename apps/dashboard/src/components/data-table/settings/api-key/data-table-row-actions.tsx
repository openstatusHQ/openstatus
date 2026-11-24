"use client";

import type { RouterOutputs } from "@openstatus/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { QuickActions } from "@/components/dropdowns/quick-actions";
import type { DataTableRow } from "@/components/ui/data-table/features";
import { useTRPC } from "@/lib/trpc/client";

type ApiKey = RouterOutputs["apiKey"]["list"][number];

interface DataTableRowActionsProps {
  row: DataTableRow<ApiKey>;
}

export function DataTableRowActions({ row }: DataTableRowActionsProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const revokeApiKeyMutation = useMutation(
    trpc.apiKey.revoke.mutationOptions({
      onSuccess: () =>
        queryClient.invalidateQueries({
          queryKey: trpc.apiKey.list.queryKey(),
        }),
    }),
  );

  return (
    <div className="flex justify-end">
      <QuickActions
        deleteAction={{
          confirmationValue: row.original.name ?? "api key",
          submitAction: async () => {
            await revokeApiKeyMutation.mutateAsync({ keyId: row.original.id });
          },
        }}
      />
    </div>
  );
}
