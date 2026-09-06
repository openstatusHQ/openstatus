import { notFound } from "next/navigation";

import { HydrateClient, fetchQueryOrNotFound, trpc } from "@/lib/trpc/server";

export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string; reportId: string }>;
}) {
  const { reportId } = await params;
  const statusReportId = Number.parseInt(reportId);
  if (Number.isNaN(statusReportId)) notFound();
  await fetchQueryOrNotFound(
    trpc.statusReport.get.queryOptions({ id: statusReportId }),
  );
  return <HydrateClient>{children}</HydrateClient>;
}
