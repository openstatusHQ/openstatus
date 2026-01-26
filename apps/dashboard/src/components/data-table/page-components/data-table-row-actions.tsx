"use client";

import { QuickActions } from "@/components/dropdowns/quick-actions";
import { getActions } from "@/data/page-components.client";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@openstatus/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Row } from "@tanstack/react-table";

type PageComponent = RouterOutputs["pageComponent"]["list"][number];

interface DataTableRowActionsProps {
  row: Row<PageComponent>;
}

export function DataTableRowActions({ row }: DataTableRowActionsProps) {
  const trpc = useTRPC();
  const actions = getActions({});
  const queryClient = useQueryClient();

  const deletePageComponentMutation = useMutation(
    trpc.pageComponent.delete.mutationOptions({
      onSuccess: () => {
        queryClient.refetchQueries({
          queryKey: trpc.pageComponent.list.queryKey({
            pageId: row.original.pageId ?? undefined,
          }),
        });
      },
    }),
  );

  return (
    <QuickActions
      actions={actions}
      deleteAction={{
        confirmationValue: row.original.name ?? "component",
        submitAction: async () => {
          await deletePageComponentMutation.mutateAsync({
            id: row.original.id,
          });
        },
      }}
    />
  );
}
