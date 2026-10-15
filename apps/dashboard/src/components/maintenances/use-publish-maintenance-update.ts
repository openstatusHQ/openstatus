"use client";

import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { useTRPC } from "@/lib/trpc/client";
import { errorMessage } from "@/lib/trpc/error";

import { useInvalidateMaintenance } from "./use-invalidate-maintenance";

/**
 * Posts a maintenance update, notifies subscribers when asked, then refetches.
 * The update is persisted before notifying, so a notification failure is
 * reported on its own and never rejects the publish. `isPending` stays true
 * through the refetch so the same message cannot be submitted twice.
 */
export function usePublishMaintenanceUpdate(maintenanceId: number) {
  const trpc = useTRPC();
  const invalidate = useInvalidateMaintenance(maintenanceId);
  const create = useMutation(trpc.maintenance.createUpdate.mutationOptions());
  const notify = useMutation(
    trpc.subscriberNotification.maintenance.mutationOptions(),
  );
  const [isPending, setIsPending] = useState(false);

  return {
    isPending,
    async publish(input: {
      message: string;
      date: Date;
      notifySubscribers: boolean;
    }) {
      setIsPending(true);
      try {
        const update = await create.mutateAsync({ maintenanceId, ...input });
        if (update && input.notifySubscribers) {
          const fallback =
            "Update published, but subscribers were not notified";
          try {
            // resolves with success=false when the plan lacks subscribers
            const result = await notify.mutateAsync({ id: update.id });
            if (!result.success) toast.error(fallback);
          } catch (error) {
            toast.error(errorMessage(error, fallback));
          }
        }
        await invalidate();
      } finally {
        setIsPending(false);
      }
    },
  };
}
