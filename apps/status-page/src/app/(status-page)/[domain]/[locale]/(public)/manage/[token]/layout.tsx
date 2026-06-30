import { HydrateClient, getQueryClient, trpc } from "@/lib/trpc/server";

export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ token: string; domain: string }>;
}) {
  const { token, domain } = await params;
  const queryClient = getQueryClient();
  await queryClient.prefetchQuery(
    trpc.statusPage.getSubscriptionByToken.queryOptions({
      token,
      slug: domain,
    }),
  );
  return <HydrateClient>{children}</HydrateClient>;
}
