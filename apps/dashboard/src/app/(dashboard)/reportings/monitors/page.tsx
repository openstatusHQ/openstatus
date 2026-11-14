import type { SearchParams } from "nuqs/server";

import { HydrateClient, getQueryClient, trpc } from "@/lib/trpc/server";

import { Client } from "./client";
import { searchParamsCache } from "./search-params";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const queryClient = getQueryClient();
  const [{ view }, workspace] = await Promise.all([
    searchParamsCache.parse(searchParams),
    queryClient.fetchQuery(trpc.workspace.get.queryOptions()),
  ]);
  await Promise.all([
    queryClient.prefetchQuery(trpc.member.list.queryOptions()),
    // a locked plan gets a FORBIDDEN, which would land in Sentry
    workspace.limits["monitor-sla"]
      ? queryClient.prefetchQuery(
          trpc.monitorReporting.list.queryOptions({
            archived: view === "archived",
          }),
        )
      : null,
  ]);

  return (
    <HydrateClient>
      <Client />
    </HydrateClient>
  );
}
