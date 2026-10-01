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

  const queryClient = getQueryClient();
  await Promise.all([
    fetchQueryOrNotFound(
      trpc.statusReport.get.queryOptions({ id: statusReportId }),
    ),
    queryClient.prefetchQuery(
      trpc.pageSubscriber.list.queryOptions({ pageId }),
    ),
    // forStatusReport throws FORBIDDEN without the feature; skip it then.
    queryClient
      .fetchQuery(trpc.workspace.get.queryOptions())
      .then((workspace) =>
        workspace.features.includes("incident-management")
          ? queryClient.prefetchQuery(
              trpc.incident.forStatusReport.queryOptions({ statusReportId }),
            )
          : undefined,
      ),
  ]);

  return (
    <HydrateClient>
      <Client id={statusReportId} pageId={pageId} />
    </HydrateClient>
  );
}
