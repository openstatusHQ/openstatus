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

  const subscribers = getQueryClient().prefetchQuery(
    trpc.pageSubscriber.list.queryOptions({ pageId }),
  );
  const maintenance = await fetchQueryOrNotFound(
    trpc.maintenance.get.queryOptions({ id: maintenanceIdNumber }),
  );
  // the URL's page must own the maintenance
  if (maintenance.pageId !== pageId) notFound();
  await subscribers;

  return (
    <HydrateClient>
      <Client id={maintenanceIdNumber} pageId={pageId} />
    </HydrateClient>
  );
}
