import { SidebarProvider } from "@openstatus/ui/components/ui/sidebar";

import {
  RIGHT_SIDEBAR_COOKIE,
  getSidebarDefaultOpen,
} from "@/lib/sidebar-cookie";
import { HydrateClient, getQueryClient, trpc } from "@/lib/trpc/server";

import { Sidebar } from "../sidebar";

export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const queryClient = getQueryClient();

  await Promise.all([
    queryClient.prefetchQuery(
      trpc.page.get.queryOptions({ id: Number.parseInt(id) }),
    ),
    queryClient.prefetchQuery(trpc.monitor.list.queryOptions()),
    queryClient.prefetchQuery(
      trpc.pageComponent.list.queryOptions({ pageId: Number.parseInt(id) }),
    ),
  ]);
  const defaultOpen = await getSidebarDefaultOpen(RIGHT_SIDEBAR_COOKIE, false);

  return (
    <HydrateClient>
      <SidebarProvider
        defaultOpen={defaultOpen}
        cookieName={RIGHT_SIDEBAR_COOKIE}
        className="min-h-0 flex-1 [--sidebar-width:18rem] 2xl:[--sidebar-width:24rem]"
      >
        <div className="w-full flex-1">{children}</div>
        <div className="hidden lg:block">
          <Sidebar />
        </div>
      </SidebarProvider>
    </HydrateClient>
  );
}
