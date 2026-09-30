"use client";

import { useQueryClient } from "@tanstack/react-query";

import { useTRPC } from "@/lib/trpc/client";

/** Refetches the incident, its timeline and the incident list. */
export function useInvalidateIncident(id: number) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return () =>
    Promise.all([
      queryClient.invalidateQueries({
        queryKey: trpc.incident.get.queryKey({ id }),
      }),
      queryClient.invalidateQueries({
        queryKey: trpc.incident.listEvents.queryKey({ id }),
      }),
      queryClient.invalidateQueries({
        queryKey: trpc.incident.list.queryKey(),
      }),
    ]);
}
