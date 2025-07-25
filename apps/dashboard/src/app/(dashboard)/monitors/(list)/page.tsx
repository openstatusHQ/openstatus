import { HydrateClient, getQueryClient, trpc } from "@/lib/trpc/server";
import type { SearchParams } from "nuqs";
import { Client } from "./client";
import { searchParamsCache } from "./search-params";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const queryClient = getQueryClient();

  await searchParamsCache.parse(searchParams);
  await queryClient.prefetchQuery(trpc.monitor.list.queryOptions());
  await queryClient.prefetchQuery(trpc.monitorTag.list.queryOptions());

  return (
    <HydrateClient>
      <Client />
    </HydrateClient>
  );
}
