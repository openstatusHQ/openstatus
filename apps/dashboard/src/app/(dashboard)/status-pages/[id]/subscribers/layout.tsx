import { getQueryClient, HydrateClient, trpc } from "@/lib/trpc/server";

export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const queryClient = getQueryClient();
  const { id } = await params;

  await queryClient.prefetchQuery(
    trpc.pageSubscriber.list.queryOptions({ pageId: parseInt(id) })
  );

  return <HydrateClient>{children}</HydrateClient>;
}
