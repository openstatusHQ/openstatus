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
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const incidentId = Number(id);
  if (!Number.isInteger(incidentId)) return notFound();

  const queryClient = getQueryClient();
  await Promise.all([
    (async () => {
      const incident = await fetchQueryOrNotFound(
        trpc.incident.get.queryOptions({ id: incidentId }),
      );
      // the postmortem query is only enabled once resolved
      if (incident.status === "resolved") {
        await queryClient.prefetchQuery(
          trpc.incident.getPostmortem.queryOptions({ id: incidentId }),
        );
      }
    })(),
    queryClient.prefetchQuery(
      trpc.incident.listEvents.queryOptions({ id: incidentId }),
    ),
    queryClient.prefetchQuery(trpc.member.list.queryOptions()),
  ]);

  return (
    <HydrateClient>
      <Client id={incidentId} />
    </HydrateClient>
  );
}
