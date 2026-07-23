import {
  AppHeader,
  AppHeaderActions,
  AppHeaderContent,
} from "@/components/nav/app-header";
import { AppSidebarTrigger } from "@/components/nav/app-sidebar";
import { HydrateClient, getQueryClient, trpc } from "@/lib/trpc/server";

import { Breadcrumb } from "./breadcrumb";
import { NavActions } from "./nav-actions";

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const queryClient = getQueryClient();

  // inputs must match page.tsx's queries exactly — a differing input misses the cache
  await Promise.all([
    queryClient.prefetchQuery(trpc.monitor.list.queryOptions()),
    queryClient.prefetchQuery(trpc.page.list.queryOptions()),
    queryClient.prefetchQuery(trpc.incident.list.queryOptions()),
    queryClient.prefetchQuery(trpc.statusReport.list.queryOptions({})),
    queryClient.prefetchQuery(trpc.maintenance.list.queryOptions()),
  ]);

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
        <main className="w-full flex-1">{children}</main>
      </div>
    </HydrateClient>
  );
}
