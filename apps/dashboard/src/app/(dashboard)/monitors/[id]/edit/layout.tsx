import { HydrateClient, getQueryClient, trpc } from "@/lib/trpc/server";

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const queryClient = getQueryClient();
  await Promise.all([
    queryClient.prefetchQuery(trpc.monitorTag.list.queryOptions()),
    queryClient.prefetchQuery(trpc.privateLocation.list.queryOptions()),
  ]);

  return <HydrateClient>{children}</HydrateClient>;
}
