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

  // `monitor.list` is prefetched by the root layout for the sidebar — the
  // client cache already holds it on every route.
  await Promise.all([
    searchParamsCache.parse(searchParams),
    queryClient.prefetchQuery(trpc.monitorTag.list.queryOptions()),
  ]);

  return (
    <HydrateClient>
      <Client />
    </HydrateClient>
  );
}
