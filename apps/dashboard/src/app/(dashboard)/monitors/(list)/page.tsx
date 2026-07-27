import type { SearchParams } from "nuqs";

import { HydrateClient, getQueryClient, trpc } from "@/lib/trpc/server";

import { Client } from "./client";
import { searchParamsCache } from "./search-params";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const queryClient = getQueryClient();

  await Promise.all([
    searchParamsCache.parse(searchParams),
    queryClient.prefetchQuery(trpc.monitor.list.queryOptions()),
    queryClient.prefetchQuery(trpc.monitorTag.list.queryOptions()),
  ]);

  return (
    <HydrateClient>
      <Client />
    </HydrateClient>
  );
}
