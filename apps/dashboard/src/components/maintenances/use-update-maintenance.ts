"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { toUpdateInput } from "@/data/maintenances.client";
import { useTRPC } from "@/lib/trpc/client";
import { errorMessage } from "@/lib/trpc/error";

import { useInvalidateMaintenance } from "./use-invalidate-maintenance";

type Patch = Partial<ReturnType<typeof toUpdateInput>>;

/**
 * `maintenance.update` takes the whole row, so the patch is spread over the
 * cached row. `onSuccess` runs after the refetch.
 */
export function useUpdateMaintenance(
  id: number,
  { onSuccess }: { onSuccess?: () => void } = {},
) {
  const trpc = useTRPC();
  const invalidate = useInvalidateMaintenance(id);
  const { data: maintenance } = useQuery(
    trpc.maintenance.get.queryOptions({ id }),
  );
  const mutation = useMutation(
    trpc.maintenance.update.mutationOptions({
      onSuccess: async () => {
        await invalidate();
        onSuccess?.();
      },
      onError: (error) => {
        toast.error(errorMessage(error, "Failed to save"));
      },
    }),
  );

  return {
    isPending: mutation.isPending,
    update: (patch: Patch) => {
      if (!maintenance) return;
      mutation.mutate({ ...toUpdateInput(maintenance), ...patch });
    },
  };
}
