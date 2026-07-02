import type { SearchParams } from "nuqs";

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
  const { id } = await params;
  const queryClient = getQueryClient();

  // NOTE: store in cache to avoid flicker on clients first render
  await searchParamsCache.parse(searchParams);
  await queryClient.prefetchQuery(
    trpc.page.getUptimeHistory.queryOptions({ id: Number.parseInt(id) }),
  );

  return (
    <HydrateClient>
      <Client />
    </HydrateClient>
  );
}
