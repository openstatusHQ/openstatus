"use client";

import type { PlaybookSlug } from "@openstatus/db/src/schema/playbooks/constants";
import { Edit } from "@openstatus/icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { QuickActions } from "@/components/dropdowns/quick-actions";
import { useTRPC } from "@/lib/trpc/client";

export function PlaybookRowActions({
  slug,
  written,
  edit = true,
}: {
  slug: PlaybookSlug;
  written: boolean;
  /** Off on the playbook's own page. */
  edit?: boolean;
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
      actions={
        edit
          ? [
              {
                id: "edit",
                label: "Edit",
                icon: Edit,
                variant: "default",
                onClick: () => router.push(`/agents/playbooks/${slug}`),
              },
            ]
          : undefined
      }
      deleteAction={
        written
          ? {
              description:
                "The agent stops following this playbook and the editor goes back to the default template. The text stays in the audit log.",
              submitAction: async () => {
                await clearMutation.mutateAsync({ slug });
              },
            }
          : undefined
      }
    />
  );
}
