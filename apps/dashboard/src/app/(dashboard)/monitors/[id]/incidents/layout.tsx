import { SidebarProvider } from "@openstatus/ui/components/ui/sidebar";

import {
  RIGHT_SIDEBAR_COOKIE,
  getSidebarDefaultOpen,
} from "@/lib/sidebar-cookie";
import { getQueryClient, trpc } from "@/lib/trpc/server";

import { Sidebar } from "../sidebar";

export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const queryClient = getQueryClient();
  const { id } = await params;
  await queryClient.prefetchQuery(
    trpc.incident.list.queryOptions({ monitorId: Number.parseInt(id) }),
  );
  const defaultOpen = await getSidebarDefaultOpen(RIGHT_SIDEBAR_COOKIE, false);

  return (
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
  );
}
