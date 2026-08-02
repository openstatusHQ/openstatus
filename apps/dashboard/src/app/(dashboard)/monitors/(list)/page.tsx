import type { SearchParams } from "nuqs";

import { HydrateClient, batchPrefetch, trpc } from "@/lib/trpc/server";

import { Client } from "./client";
import { searchParamsCache } from "./search-params";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  batchPrefetch([
    trpc.monitor.list.queryOptions(),
    trpc.monitorTag.list.queryOptions(),
  ]);
  await searchParamsCache.parse(searchParams);

  return (
    <HydrateClient>
      <Client />
    </HydrateClient>
  );
}
