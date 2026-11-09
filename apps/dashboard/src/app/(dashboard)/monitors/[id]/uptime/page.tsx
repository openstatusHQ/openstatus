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
  const monitorId = Number.parseInt(id);
  if (Number.isNaN(monitorId)) notFound();
  const queryClient = getQueryClient();

  await searchParamsCache.parse(searchParams);
  const workspace = await queryClient.fetchQuery(
    trpc.workspace.get.queryOptions(),
  );
  // plans without uptime history get a FORBIDDEN, which would land in Sentry;
  // not awaited: the pending query streams to the client behind a skeleton
  if (workspace.limits["uptime-history"]) {
    void queryClient.prefetchQuery(
      trpc.monitor.getUptimeHistory.queryOptions({ id: monitorId }),
    );
  }

  return (
    <HydrateClient>
      <Client />
    </HydrateClient>
  );
}
