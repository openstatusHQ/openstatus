"use client";

import { useQueryClient } from "@tanstack/react-query";

import { useTRPC } from "@/lib/trpc/client";

/** Refetches the maintenance, every maintenance list and the window lists that show its link. */
export function useInvalidateMaintenance(id: number) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return () =>
    Promise.all([
      queryClient.invalidateQueries({
        queryKey: trpc.maintenance.get.queryKey({ id }),
      }),
      queryClient.invalidateQueries({
        queryKey: trpc.maintenance.list.queryKey(),
      }),
      queryClient.invalidateQueries({
        queryKey: trpc.maintenanceWindow.list.queryKey(),
      }),
    ]);
}
