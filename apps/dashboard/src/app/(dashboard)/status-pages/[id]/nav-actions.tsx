"use client";

import { QuickActions } from "@/components/dropdowns/quick-actions";
import { getActions } from "@/data/status-pages.client";
import { useTRPC } from "@/lib/trpc/client";
import { useMutation } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";

export function NavActions() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const trpc = useTRPC();

  const deleteStatusPageMutation = useMutation(
    trpc.page.delete.mutationOptions({
      onSuccess: () => router.push("/status-pages"),
    })
  );

  const actions = getActions({
    edit: () => router.push(`/status-pages/${id}/edit`),
    "copy-id": () => {
      navigator.clipboard.writeText("ID");
      toast.success("Status Page ID copied to clipboard");
    },
  });

  return (
    <div className="flex items-center gap-2 text-sm">
      <QuickActions
        actions={actions}
        deleteAction={{
          title: "Status Page",
          confirmationValue: "delete status page",
          submitAction: async () => {
            await deleteStatusPageMutation.mutateAsync({
              id: parseInt(id),
            });
          },
        }}
      />
    </div>
  );
}
