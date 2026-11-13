import { HydrateClient, getQueryClient, trpc } from "@/lib/trpc/server";

import { Client } from "./client";

export default async function Page() {
  const queryClient = getQueryClient();
  const workspace = await queryClient.fetchQuery(
    trpc.workspace.get.queryOptions(),
  );
  await Promise.all([
    queryClient.prefetchQuery(trpc.member.list.queryOptions()),
    queryClient.prefetchQuery(trpc.incidentReporting.get.queryOptions()),
    // a locked plan gets a FORBIDDEN, which would land in Sentry
    workspace.limits["incident-sla"]
      ? queryClient.prefetchQuery(
          trpc.incidentReporting.attainment.queryOptions(),
        )
      : null,
  ]);

  return (
    <HydrateClient>
      <Client />
    </HydrateClient>
  );
}
