"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { toUpdateInput } from "@/data/maintenances.client";
import { useTRPC } from "@/lib/trpc/client";
import { errorMessage } from "@/lib/trpc/error";

import { useInvalidateMaintenance } from "./use-invalidate-maintenance";

type Patch = Partial<ReturnType<typeof toUpdateInput>>;

/**
 * `maintenance.update` takes the whole row, so the patch is spread over the
 * cached row, which is patched right away: a second save that lands before
 * the first one's refetch then carries the first one's values instead of
 * reverting them. `onSuccess` runs after the refetch.
 */
export function useUpdateMaintenance(
  id: number,
  { onSuccess }: { onSuccess?: () => void } = {},
) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const invalidate = useInvalidateMaintenance(id);
  const queryKey = trpc.maintenance.get.queryKey({ id });
  const mutation = useMutation(
    trpc.maintenance.update.mutationOptions({
      onSuccess: async () => {
        await invalidate();
        onSuccess?.();
      },
      onError: async (error) => {
        toast.error(errorMessage(error, "Failed to save"));
        await invalidate();
      },
    }),
  );

  return {
    isPending: mutation.isPending,
    update: (patch: Patch) => {
      const maintenance = queryClient.getQueryData(queryKey);
      if (!maintenance) return;
      const input = { ...toUpdateInput(maintenance), ...patch };
      queryClient.setQueryData(queryKey, {
        ...maintenance,
        title: input.title,
        message: input.message,
        from: input.startDate,
        to: input.endDate,
        pageComponentIds: input.pageComponents ?? maintenance.pageComponentIds,
      });
      mutation.mutate(input);
    },
  };
}
