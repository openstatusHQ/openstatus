import { HydrateClient, fetchQueryOrNotFound, trpc } from "@/lib/trpc/server";

export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string; reportId: string }>;
}) {
  const { id, reportId } = await params;
  await Promise.all([
    fetchQueryOrNotFound(
      trpc.statusReport.get.queryOptions({ id: Number.parseInt(reportId) }),
    ),
    fetchQueryOrNotFound(
      trpc.page.get.queryOptions({ id: Number.parseInt(id) }),
    ),
  ]);
  return <HydrateClient>{children}</HydrateClient>;
}
