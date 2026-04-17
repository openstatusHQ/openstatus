import { HydrateClient, getQueryClient, trpc } from "@/lib/trpc/server";
import { notFound } from "next/navigation";

export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string; domain: string }>;
}) {
  const { id, domain } = await params;
  const numericId = Number(id);

  if (Number.isNaN(numericId)) {
    return notFound();
  }

  const queryClient = getQueryClient();
  await queryClient.prefetchQuery(
    trpc.statusPage.getReport.queryOptions({
      id: numericId,
      slug: domain,
    }),
  );
  return <HydrateClient>{children}</HydrateClient>;
}
