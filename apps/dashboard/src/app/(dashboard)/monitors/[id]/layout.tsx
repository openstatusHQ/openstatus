import { notFound } from "next/navigation";

import {
  AppHeader,
  AppHeaderActions,
  AppHeaderContent,
} from "@/components/nav/app-header";
import { AppSidebarTrigger } from "@/components/nav/app-sidebar";
import {
  HydrateClient,
  fetchQueryOrNotFound,
  getQueryClient,
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
  const monitorId = Number.parseInt(id);
  if (Number.isNaN(monitorId)) notFound();
  const queryClient = getQueryClient();

  const [monitor] = await Promise.all([
    fetchQueryOrNotFound(trpc.monitor.get.queryOptions({ id: monitorId })),
    queryClient.prefetchQuery(trpc.privateLocation.list.queryOptions()),
  ]);
  // the overview picks "waiting for first ping" or the ping chart from this
  if (monitor.jobType === "heartbeat") {
    await queryClient.prefetchQuery(
      trpc.monitor.heartbeat.queryOptions({ id: monitorId }),
    );
  }

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
