import { AppHeader, AppHeaderContent } from "@/components/nav/app-header";
import { AppSidebarTrigger } from "@/components/nav/app-sidebar";

import { Breadcrumb } from "./breadcrumb";
import { getQueryClient, HydrateClient, trpc } from "@/lib/trpc/server";

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const queryClient = getQueryClient();
  await queryClient.prefetchQuery(trpc.member.list.queryOptions());
  await queryClient.prefetchQuery(trpc.invitation.list.queryOptions());
  await queryClient.prefetchQuery(trpc.apiKey.get.queryOptions());

  return (
    <HydrateClient>
      <div>
        <AppHeader>
          <AppHeaderContent>
            <AppSidebarTrigger />
            <Breadcrumb />
          </AppHeaderContent>
        </AppHeader>
        <main className="w-full flex-1">{children}</main>
      </div>
    </HydrateClient>
  );
}
