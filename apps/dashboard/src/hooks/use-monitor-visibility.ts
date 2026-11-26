import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "@/lib/trpc/client";

/** Visibility of a monitor across the status pages it is a component of. */
export function useMonitorVisibility(monitorId: number) {
  const trpc = useTRPC();
  const { data } = useQuery(trpc.pageComponent.list.queryOptions());
  if (!data) return undefined;
  const components = data.filter((c) => c.monitorId === monitorId);
  return {
    pages: components.length,
    publicPages: components.filter((c) => c.public).length,
  };
}

export function formatMonitorVisibility(
  visibility: ReturnType<typeof useMonitorVisibility>,
) {
  if (!visibility) return "-";
  if (visibility.pages === 0) return "Not on a status page";
  return `Public on ${visibility.publicPages} of ${visibility.pages} ${
    visibility.pages === 1 ? "page" : "pages"
  }`;
}
