import { AppSidebar } from "@/components/nav/app-sidebar";
import {
  LEFT_SIDEBAR_COOKIE,
  getSidebarDefaultOpen,
} from "@/lib/sidebar-cookie";
import { HydrateClient, getQueryClient, trpc } from "@/lib/trpc/server";
import {
  SidebarInset,
  SidebarProvider,
} from "@openstatus/ui/components/ui/sidebar";

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const defaultOpen = await getSidebarDefaultOpen(LEFT_SIDEBAR_COOKIE, true);

  return (
    <HydrateSidebar>
      <SidebarProvider
        defaultOpen={defaultOpen}
        cookieName={LEFT_SIDEBAR_COOKIE}
      >
        <AppSidebar />
        <SidebarInset>{children}</SidebarInset>
      </SidebarProvider>
    </HydrateSidebar>
  );
}

async function HydrateSidebar({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient();
  await queryClient.prefetchQuery(trpc.page.list.queryOptions());
  await queryClient.prefetchQuery(trpc.monitor.list.queryOptions());
  await queryClient.prefetchQuery(trpc.workspace.get.queryOptions());
  await queryClient.prefetchQuery(trpc.user.get.queryOptions());

  return <HydrateClient>{children}</HydrateClient>;
}
