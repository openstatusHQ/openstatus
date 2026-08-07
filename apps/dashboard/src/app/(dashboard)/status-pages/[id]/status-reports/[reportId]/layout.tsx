import { HydrateClient, fetchQueryOrNotFound, trpc } from "@/lib/trpc/server";

export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string; reportId: string }>;
}) {
  const { reportId } = await params;
  await fetchQueryOrNotFound(
    trpc.statusReport.get.queryOptions({ id: Number.parseInt(reportId) }),
  );
  return <HydrateClient>{children}</HydrateClient>;
}
