import { notFound } from "next/navigation";

import { HydrateClient, getQueryClient, trpc } from "@/lib/trpc/server";

import { Client } from "./client";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const monitorId = Number.parseInt(id);
  if (Number.isNaN(monitorId)) notFound();
  const queryClient = getQueryClient();
  await queryClient.prefetchQuery(
    trpc.monitor.getUptimeHistory.queryOptions({ id: monitorId }),
  );

  return (
    <HydrateClient>
      <Client />
    </HydrateClient>
  );
}
