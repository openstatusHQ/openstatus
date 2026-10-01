"use client";

import { useQueryClient } from "@tanstack/react-query";

import { useTRPC } from "@/lib/trpc/client";

/** Refetches the report, every report list, the page list and the linked incident. */
export function useInvalidateStatusReport(id: number) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return () =>
    Promise.all([
      queryClient.invalidateQueries({
        queryKey: trpc.statusReport.get.queryKey({ id }),
      }),
      queryClient.invalidateQueries({
        queryKey: trpc.statusReport.list.queryKey(),
      }),
      queryClient.invalidateQueries({
        queryKey: trpc.page.list.queryKey(),
      }),
      queryClient.invalidateQueries({
        queryKey: trpc.incident.forStatusReport.queryKey({
          statusReportId: id,
        }),
      }),
    ]);
}
