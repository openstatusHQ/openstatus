"use client";

import type { RouterOutputs } from "@openstatus/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { QuickActions } from "@/components/dropdowns/quick-actions";
import { getActions } from "@/data/maintenances.client";
import { useTRPC } from "@/lib/trpc/client";

type Maintenance = NonNullable<RouterOutputs["maintenance"]["get"]>;

export function MaintenanceActions({
  maintenance,
  onEdit,
}: {
  maintenance: Maintenance;
  onEdit: () => void;
}) {
  const trpc = useTRPC();
  const router = useRouter();
  const queryClient = useQueryClient();
  const remove = useMutation(
    trpc.maintenance.delete.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: trpc.maintenance.list.queryKey(),
        });
        router.push(`/status-pages/${maintenance.pageId}/maintenances`);
      },
    }),
  );

  return (
    <QuickActions
      actions={getActions({ edit: onEdit })}
      deleteAction={{
        confirmationValue: maintenance.title,
        submitAction: async () => {
          await remove.mutateAsync({ id: maintenance.id });
        },
      }}
    />
  );
}
