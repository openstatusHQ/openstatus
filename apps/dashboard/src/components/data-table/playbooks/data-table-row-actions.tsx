"use client";

import { isBuiltinPlaybookSlug } from "@openstatus/db/src/schema/playbooks/constants";
import { Edit } from "@openstatus/icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { QuickActions } from "@/components/dropdowns/quick-actions";
import { useTRPC } from "@/lib/trpc/client";

export function PlaybookRowActions({
  slug,
  title,
  written,
  edit = true,
}: {
  slug: string;
  title: string;
  written: boolean;
  /** Off on the playbook's own page. */
  edit?: boolean;
}) {
  const trpc = useTRPC();
  const router = useRouter();
  const queryClient = useQueryClient();
  const builtin = isBuiltinPlaybookSlug(slug);
  const deleteMutation = useMutation(
    trpc.playbook.delete.mutationOptions({
      onSuccess: async () => {
        // a deleted custom playbook has no page left to stay on
        if (!edit && !builtin) router.push("/agents/playbooks");
        await queryClient.invalidateQueries({
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
              confirmationValue: title,
              description: builtin
                ? "The agent stops following this playbook and the editor goes back to the default template. The text stays in the audit log."
                : "The playbook is removed and the agent stops following it. The text stays in the audit log.",
              submitAction: async () => {
                await deleteMutation.mutateAsync({ slug });
              },
            }
          : undefined
      }
    />
  );
}
