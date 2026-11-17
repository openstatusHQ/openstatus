import { notFound } from "next/navigation";

import {
  HydrateClient,
  fetchQueryOrNotFound,
  getQueryClient,
  trpc,
} from "@/lib/trpc/server";

import { Client } from "./client";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string; maintenanceId: string }>;
}) {
  const { id, maintenanceId } = await params;
  const pageId = Number(id);
  const maintenanceIdNumber = Number(maintenanceId);
  if (!Number.isInteger(pageId) || !Number.isInteger(maintenanceIdNumber)) {
    notFound();
  }

  const queryClient = getQueryClient();
  const prefetched = Promise.all([
    queryClient.prefetchQuery(
      trpc.pageSubscriber.list.queryOptions({ pageId }),
    ),
    queryClient.prefetchQuery(trpc.maintenanceWindow.list.queryOptions()),
  ]);
  const maintenance = await fetchQueryOrNotFound(
    trpc.maintenance.get.queryOptions({ id: maintenanceIdNumber }),
  );
  // the URL's page must own the maintenance
  if (maintenance.pageId !== pageId) notFound();
  await prefetched;

  return (
    <HydrateClient>
      <Client id={maintenanceIdNumber} pageId={pageId} />
    </HydrateClient>
  );
}
