import { HydrateClient, getQueryClient, trpc } from "@/lib/trpc/server";

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const queryClient = getQueryClient();
  await queryClient.prefetchQuery(trpc.monitorTag.list.queryOptions());
  await queryClient.prefetchQuery(trpc.privateLocation.list.queryOptions());

  return <HydrateClient>{children}</HydrateClient>;
}
