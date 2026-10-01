"use client";

import type { RouterOutputs } from "@openstatus/api";
import { Show } from "@openstatus/icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { QuickActions } from "@/components/dropdowns/quick-actions";
import { useTRPC } from "@/lib/trpc/client";

type Maintenance = NonNullable<RouterOutputs["maintenance"]["get"]>;

export function MaintenanceActions({
  maintenance,
  publicUrl,
}: {
  maintenance: Maintenance;
  publicUrl: string;
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
      actions={[
        {
          id: "view",
          label: "View Page",
          icon: Show,
          variant: "default",
          onClick: () => {
            window.open(publicUrl, "_blank");
          },
        },
      ]}
      deleteAction={{
        confirmationValue: maintenance.title,
        submitAction: async () => {
          await remove.mutateAsync({ id: maintenance.id });
        },
      }}
    />
  );
}
