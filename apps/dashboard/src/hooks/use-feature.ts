import { useTRPC } from "@/lib/trpc/client";
import { useQuery } from "@tanstack/react-query";

/**
 * Record<feature, [workspaceId, ...]>
 */
const features = {
  "slack-agent": [1, 6850],
};

export function useFeature(feature: keyof typeof features) {
  const trpc = useTRPC();
  const { data: workspace } = useQuery(trpc.workspace.get.queryOptions());

  if (!workspace) return false;

  return features[feature]?.includes(workspace.id) ?? false;
}
