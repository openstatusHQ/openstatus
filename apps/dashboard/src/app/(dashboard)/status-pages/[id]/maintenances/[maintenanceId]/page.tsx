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
  if (!Number.isInteger(maintenanceIdNumber)) notFound();

  await fetchQueryOrNotFound(
    trpc.maintenance.get.queryOptions({ id: maintenanceIdNumber }),
  );
  const queryClient = getQueryClient();
  await queryClient.prefetchQuery(
    trpc.pageSubscriber.list.queryOptions({ pageId }),
  );

  return (
    <HydrateClient>
      <Client id={maintenanceIdNumber} pageId={pageId} />
    </HydrateClient>
  );
}
