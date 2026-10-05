import { notFound } from "next/navigation";

import { HydrateClient, getQueryClient, trpc } from "@/lib/trpc/server";

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
  // Throws NOT_FOUND for a foreign id; prefetchQuery swallows it and the
  // client renders the empty state.
  await Promise.all([
    queryClient
      .prefetchQuery(trpc.incident.get.queryOptions({ id: incidentId }))
      .then(() =>
        queryClient.getQueryData(
          trpc.incident.get.queryKey({ id: incidentId }),
        ),
      )
      // the postmortem query is only enabled once resolved
      .then((incident) =>
        incident?.status === "resolved"
          ? queryClient.prefetchQuery(
              trpc.incident.getPostmortem.queryOptions({ id: incidentId }),
            )
          : undefined,
      ),
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
