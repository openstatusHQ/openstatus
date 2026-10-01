"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useTRPC } from "@/lib/trpc/client";

import { useInvalidateStatusReport } from "./use-invalidate-status-report";

/**
 * Posts a status-report update, notifies subscribers when asked, then
 * refetches the report and any incident that embeds it.
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
        await notify.mutateAsync({ id: update.id });
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
