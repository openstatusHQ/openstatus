import { HydrateClient, getQueryClient, trpc } from "@/lib/trpc/server";

export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { id: string; domain: string };
}) {
  const queryClient = getQueryClient();
  await queryClient.prefetchQuery(
    trpc.statusPage.getReport.queryOptions({
      id: Number(params.id),
      slug: params.domain,
    }),
  );
  return <HydrateClient>{children}</HydrateClient>;
}
