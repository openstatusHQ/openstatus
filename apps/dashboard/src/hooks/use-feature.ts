import type { Feature } from "@openstatus/services";
import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "@/lib/trpc/client";

export function useFeature(feature: Feature) {
  const trpc = useTRPC();
  const { data: workspace } = useQuery(trpc.workspace.get.queryOptions());

  return workspace?.features.includes(feature) ?? false;
}
