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
}: { children: React.ReactNode }) {
  const queryClient = getQueryClient();

  await queryClient.prefetchQuery(trpc.monitor.list.queryOptions());
  await queryClient.prefetchQuery(trpc.page.list.queryOptions());
  await queryClient.prefetchQuery(
    trpc.incident.list.queryOptions({
      period: "7d",
    }),
  );
  await queryClient.prefetchQuery(
    trpc.statusReport.list.queryOptions({
      period: "7d",
    }),
  );
  await queryClient.prefetchQuery(
    trpc.maintenance.list.queryOptions({
      period: "7d",
    }),
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
        <main className="w-full flex-1">{children}</main>
      </div>
    </HydrateClient>
  );
}
