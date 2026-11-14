import type { SearchParams } from "nuqs/server";

import { HydrateClient, getQueryClient, trpc } from "@/lib/trpc/server";

import { Client } from "./client";
import { searchParamsCache } from "./search-params";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const queryClient = getQueryClient();
  const [{ id }, { months }, workspace] = await Promise.all([
    params,
    searchParamsCache.parse(searchParams),
    queryClient.fetchQuery(trpc.workspace.get.queryOptions()),
  ]);
  // the layout already 404s an unknown id; a locked plan gets the paywall
  if (workspace.limits["monitor-sla"]) {
    await queryClient.prefetchQuery(
      trpc.monitorReporting.get.queryOptions({
        id: Number.parseInt(id),
        months,
      }),
    );
  }

  return (
    <HydrateClient>
      <Client />
    </HydrateClient>
  );
}
