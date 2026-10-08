import { notFound } from "next/navigation";
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
  const pageId = Number.parseInt(id);
  if (Number.isNaN(pageId)) notFound();
  const queryClient = getQueryClient();

  // NOTE: store in cache to avoid flicker on clients first render
  await searchParamsCache.parse(searchParams);
  await queryClient.prefetchQuery(
    trpc.page.getUptimeHistory.queryOptions({ id: pageId }),
  );

  return (
    <HydrateClient>
      <Client />
    </HydrateClient>
  );
}
