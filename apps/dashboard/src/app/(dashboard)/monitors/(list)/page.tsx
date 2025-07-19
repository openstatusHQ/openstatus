import { getQueryClient, HydrateClient, trpc } from "@/lib/trpc/server";
import { Client } from "./client";
import { searchParamsCache } from "./search-params";
import { SearchParams } from "nuqs";

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
