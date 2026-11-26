"use client";

import type { PlaybookType } from "@openstatus/db/src/schema/playbooks/constants";
import { Edit } from "@openstatus/icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { QuickActions } from "@/components/dropdowns/quick-actions";
import { playbookSlug } from "@/data/playbooks.client";
import { useTRPC } from "@/lib/trpc/client";

export function PlaybookRowActions({
  type,
  written,
}: {
  type: PlaybookType;
  written: boolean;
}) {
  const trpc = useTRPC();
  const router = useRouter();
  const queryClient = useQueryClient();
  const clearMutation = useMutation(
    trpc.playbook.clear.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.playbook.pathKey(),
        });
      },
    }),
  );

  return (
    <QuickActions
      actions={[
        {
          id: "edit",
          label: "Edit",
          icon: Edit,
          variant: "default",
          onClick: () => router.push(`/agents/playbooks/${playbookSlug(type)}`),
        },
      ]}
      deleteAction={
        written
          ? {
              description:
                "The agent stops following this playbook and the editor goes back to the default template. The text stays in the audit log.",
              submitAction: async () => {
                await clearMutation.mutateAsync({ type });
              },
            }
          : undefined
      }
    />
  );
}
