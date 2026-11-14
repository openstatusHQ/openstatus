import type { SearchParams } from "nuqs/server";

import { completeSlaMonths } from "@/data/reportings.client";
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
  const [{ id }, { month }, workspace] = await Promise.all([
    params,
    searchParamsCache.parse(searchParams),
    queryClient.fetchQuery(trpc.workspace.get.queryOptions()),
  ]);
  // the layout already 404s an unknown id; a locked plan gets the paywall
  if (workspace.limits["monitor-sla"]) {
    const policyId = Number.parseInt(id);
    const summary = await queryClient.fetchQuery(
      trpc.monitorReporting.summary.queryOptions({ id: policyId }),
    );
    await queryClient.prefetchQuery(
      trpc.monitorReporting.report.queryOptions({
        id: policyId,
        month: month ?? completeSlaMonths(summary.timeZone, 1)[0].slice(0, 7),
      }),
    );
  }

  return (
    <HydrateClient>
      <Client />
    </HydrateClient>
  );
}
