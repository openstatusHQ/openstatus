import { HydrateClient, trpc, getQueryClient } from "@/lib/trpc/server";

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const queryClient = getQueryClient();
  await queryClient.prefetchQuery(trpc.monitorTag.list.queryOptions());

  return <HydrateClient>{children}</HydrateClient>;
}
