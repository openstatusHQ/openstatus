import { HydrateClient, getQueryClient, trpc } from "@/lib/trpc/server";

export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string; reportId: string }>;
}) {
  const { id, reportId } = await params;
  const queryClient = getQueryClient();
  await queryClient.prefetchQuery(
    trpc.statusReport.get.queryOptions({ id: Number.parseInt(reportId) }),
  );
  await queryClient.prefetchQuery(
    trpc.page.get.queryOptions({ id: Number.parseInt(id) }),
  );
  return <HydrateClient>{children}</HydrateClient>;
}
