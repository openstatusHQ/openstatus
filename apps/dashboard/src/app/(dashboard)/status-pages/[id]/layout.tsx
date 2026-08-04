import {
  AppHeader,
  AppHeaderActions,
  AppHeaderContent,
} from "@/components/nav/app-header";
import { AppSidebarTrigger } from "@/components/nav/app-sidebar";
import {
  HydrateClient,
  fetchQueryOrNotFound,
  prefetch,
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

  // Started before the gate is awaited so the 404 check costs one round trip
  // rather than serialising ahead of it.
  prefetch(trpc.monitor.list.queryOptions());
  await fetchQueryOrNotFound(
    trpc.page.get.queryOptions({ id: Number.parseInt(id) }),
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
