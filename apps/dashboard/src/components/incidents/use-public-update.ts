"use client";

import type { statusReportStatus } from "@openstatus/db/src/schema/status_reports/constants";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useTRPC } from "@/lib/trpc/client";

/** Posts a status-report update and, when asked, notifies subscribers. */
export function usePublicUpdate(incidentId: number) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const createUpdate = useMutation(
    trpc.statusReport.createStatusReportUpdate.mutationOptions(),
  );
  const notify = useMutation(
    trpc.subscriberNotification.statusReport.mutationOptions(),
  );

  return {
    isPending: createUpdate.isPending || notify.isPending,
    async post(args: {
      statusReportId: number;
      status: (typeof statusReportStatus)[number];
      message: string;
      notifySubscribers: boolean;
    }) {
      const update = await createUpdate.mutateAsync({
        statusReportId: args.statusReportId,
        status: args.status,
        message: args.message,
        date: new Date(),
        notifySubscribers: args.notifySubscribers,
      });
      if (update && args.notifySubscribers) {
        await notify.mutateAsync({ id: update.id });
      }
      await queryClient.invalidateQueries({
        queryKey: trpc.incident.get.queryKey({ id: incidentId }),
      });
    },
  };
}
