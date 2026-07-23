import { HydrateClient, getQueryClient, trpc } from "@/lib/trpc/server";

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const queryClient = getQueryClient();
  await Promise.all([
    queryClient.prefetchQuery(trpc.workspace.get.queryOptions()),
    queryClient.prefetchQuery(trpc.user.get.queryOptions()),
    queryClient.prefetchQuery(trpc.monitor.list.queryOptions()),
    queryClient.prefetchQuery(trpc.page.list.queryOptions()),
  ]);

  return <HydrateClient>{children}</HydrateClient>;
}
