"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useTRPC } from "@/lib/trpc/client";
import { errorMessage } from "@/lib/trpc/error";

import { useInvalidateStatusReport } from "./use-invalidate-status-report";

/**
 * Posts a status-report update, notifies subscribers when asked, then
 * refetches the report and any incident that embeds it. The update is
 * persisted before notifying, so a notification failure is reported on its
 * own and never rejects the publish (a retry would duplicate the update).
 */
export function usePublishUpdate(statusReportId: number) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const invalidate = useInvalidateStatusReport(statusReportId);
  const create = useMutation(
    trpc.statusReport.createStatusReportUpdate.mutationOptions(),
  );
  const notify = useMutation(
    trpc.subscriberNotification.statusReport.mutationOptions(),
  );

  return {
    isPending: create.isPending || notify.isPending,
    async publish(input: Parameters<typeof create.mutateAsync>[0]) {
      const update = await create.mutateAsync(input);
      if (update && input.notifySubscribers) {
        const fallback = "Update published, but subscribers were not notified";
        try {
          // resolves with success=false when the plan lacks subscribers
          const result = await notify.mutateAsync({ id: update.id });
          if (!result.success) toast.error(fallback);
        } catch (error) {
          toast.error(errorMessage(error, fallback));
        }
      }
      await Promise.all([
        invalidate(),
        queryClient.invalidateQueries({
          queryKey: trpc.incident.get.queryKey(),
        }),
      ]);
    },
  };
}
