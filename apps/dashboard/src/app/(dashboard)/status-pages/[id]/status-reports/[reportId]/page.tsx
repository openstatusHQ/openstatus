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
  params: Promise<{ id: string; reportId: string }>;
}) {
  const { id, reportId } = await params;
  const pageId = Number(id);
  const statusReportId = Number(reportId);
  if (!Number.isInteger(statusReportId)) notFound();

  await fetchQueryOrNotFound(
    trpc.statusReport.get.queryOptions({ id: statusReportId }),
  );
  const queryClient = getQueryClient();
  // forStatusReport throws FORBIDDEN without the feature; prefetch swallows it.
  await Promise.all([
    queryClient.prefetchQuery(trpc.workspace.get.queryOptions()),
    queryClient.prefetchQuery(trpc.user.get.queryOptions()),
    queryClient.prefetchQuery(
      trpc.pageSubscriber.list.queryOptions({ pageId }),
    ),
    queryClient.prefetchQuery(
      trpc.incident.forStatusReport.queryOptions({ statusReportId }),
    ),
  ]);

  return (
    <HydrateClient>
      <Client id={statusReportId} />
    </HydrateClient>
  );
}
