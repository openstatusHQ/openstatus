import {
  AppHeader,
  AppHeaderActions,
  AppHeaderContent,
} from "@/components/nav/app-header";
import { AppSidebarTrigger } from "@/components/nav/app-sidebar";
import {
  HydrateClient,
  batchPrefetch,
  fetchQueryOrNotFound,
  trpc,
} from "@/lib/trpc/server";

import { Breadcrumb } from "./breadcrumb";
import { NavActions } from "./nav-actions";
import { Tabs } from "./tabs";

export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  batchPrefetch([
    trpc.notification.list.queryOptions(),
    trpc.privateLocation.list.queryOptions(),
  ]);
  await fetchQueryOrNotFound(
    trpc.monitor.get.queryOptions({ id: Number.parseInt(id) }),
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
        <Tabs />
        <main className="flex-1">{children}</main>
      </div>
    </HydrateClient>
  );
}
