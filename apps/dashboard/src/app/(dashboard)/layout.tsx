import { TRPCReactProvider } from "@/lib/trpc/client";
import { AppSidebar } from "@/components/nav/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { auth } from "@/lib/auth";
import { SessionProvider } from "next-auth/react";
import { getQueryClient, HydrateClient, trpc } from "@/lib/trpc/server";

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  return (
    <SessionProvider session={session}>
      <TRPCReactProvider>
        <HydrateSidebar>
          <SidebarProvider>
            <AppSidebar />
            <SidebarInset>{children}</SidebarInset>
          </SidebarProvider>
        </HydrateSidebar>
      </TRPCReactProvider>
    </SessionProvider>
  );
}

async function HydrateSidebar({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient();
  await queryClient.prefetchQuery(trpc.page.list.queryOptions());
  await queryClient.prefetchQuery(trpc.monitor.list.queryOptions());
  await queryClient.prefetchQuery(trpc.workspace.get.queryOptions());

  return <HydrateClient>{children}</HydrateClient>;
}
