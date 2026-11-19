import { notFound } from "next/navigation";
import type { SearchParams } from "nuqs";

import { reportRange } from "@/data/monitor-report";
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

  const { period, from, to } = await searchParamsCache.parse(searchParams);
  const range = reportRange({ period, from, to }, new Date());

  const workspace = await queryClient.fetchQuery(
    trpc.workspace.get.queryOptions(),
  );
  await Promise.all([
    queryClient.prefetchQuery(
      trpc.monitorIncident.report.queryOptions({ monitorId, ...range }),
    ),
    // plans without uptime history get a FORBIDDEN, which would land in Sentry
    workspace.limits["uptime-history"]
      ? queryClient.prefetchQuery(
          trpc.monitor.getUptimeHistory.queryOptions({ id: monitorId }),
        )
      : null,
  ]);

  return (
    <HydrateClient>
      <Client />
    </HydrateClient>
  );
}
