import { HydrateClient, getQueryClient, trpc } from "@/lib/trpc/server";

import { Client } from "./client";

export default async function Page() {
  const queryClient = getQueryClient();
  await Promise.all([
    queryClient.prefetchQuery(trpc.maintenanceWindow.list.queryOptions()),
    queryClient.prefetchQuery(trpc.monitor.list.queryOptions()),
  ]);

  return (
    <HydrateClient>
      <Client />
    </HydrateClient>
  );
}
