import {
  AppHeader,
  AppHeaderActions,
  AppHeaderContent,
} from "@/components/nav/app-header";
import { AppSidebarTrigger } from "@/components/nav/app-sidebar";

import { Breadcrumb } from "./breadcrumb";
import { NavActions } from "./nav-actions";
import { getQueryClient, HydrateClient, trpc } from "@/lib/trpc/server";

export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const queryClient = getQueryClient();

  await queryClient.prefetchQuery(
    trpc.page.get.queryOptions({ id: parseInt(id) })
  );
  return (
    <HydrateClient>
      <div>
        <AppHeader>
          <AppHeaderContent>
            <AppSidebarTrigger />
            <Breadcrumb />
          </AppHeaderContent>
          <AppHeaderActions>
            <NavActions />
          </AppHeaderActions>
        </AppHeader>
        <main className="flex-1">{children}</main>
      </div>
    </HydrateClient>
  );
}
