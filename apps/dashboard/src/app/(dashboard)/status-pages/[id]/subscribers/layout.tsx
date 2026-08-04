import { HydrateClient, prefetch, trpc } from "@/lib/trpc/server";

export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  prefetch(
    trpc.pageSubscriber.list.queryOptions({ pageId: Number.parseInt(id) }),
  );

  return <HydrateClient>{children}</HydrateClient>;
}
