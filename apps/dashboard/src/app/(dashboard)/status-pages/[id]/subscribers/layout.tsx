import { notFound } from "next/navigation";

import { HydrateClient, getQueryClient, trpc } from "@/lib/trpc/server";

export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const queryClient = getQueryClient();
  const { id } = await params;
  const pageId = Number.parseInt(id);
  if (Number.isNaN(pageId)) notFound();

  await queryClient.prefetchQuery(
    trpc.pageSubscriber.list.queryOptions({ pageId }),
  );

  return <HydrateClient>{children}</HydrateClient>;
}
