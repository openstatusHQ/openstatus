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
  // Throws FORBIDDEN without the feature / NOT_FOUND for a foreign id;
  // prefetchQuery swallows both and the client renders the empty state.
  await Promise.all([
    queryClient.prefetchQuery(
      trpc.incident.get.queryOptions({ id: incidentId }),
    ),
    queryClient.prefetchQuery(
      trpc.incident.listEvents.queryOptions({ id: incidentId }),
    ),
    queryClient.prefetchQuery(trpc.member.list.queryOptions()),
    queryClient.prefetchQuery(
      trpc.statusReport.list.queryOptions({ order: "desc" }),
    ),
  ]);

  return (
    <HydrateClient>
      <Client id={incidentId} />
    </HydrateClient>
  );
}
