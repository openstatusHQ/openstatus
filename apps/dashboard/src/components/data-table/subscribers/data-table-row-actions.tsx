"use client";

import { QuickActions } from "@/components/dropdowns/quick-actions";
import { useTRPC } from "@/lib/trpc/client";
import { RouterOutputs } from "@openstatus/api";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { Row } from "@tanstack/react-table";

type Subscriber = RouterOutputs["pageSubscriber"]["list"][number];

interface DataTableRowActionsProps {
  row: Row<Subscriber>;
}

export function DataTableRowActions({ row }: DataTableRowActionsProps) {
  const trpc = useTRPC();
  const { refetch } = useQuery(
    trpc.pageSubscriber.list.queryOptions({
      pageId: row.original.pageId,
    })
  );

  const deleteAction = useMutation(
    trpc.pageSubscriber.delete.mutationOptions({
      onSuccess: () => refetch(),
    })
  );

  return (
    <QuickActions
      actions={[]}
      deleteAction={{
        title: "Subscribers",
        submitAction: async () => {
          await deleteAction.mutateAsync({
            id: row.original.id,
            pageId: row.original.pageId,
          });
        },
      }}
    />
  );
}
