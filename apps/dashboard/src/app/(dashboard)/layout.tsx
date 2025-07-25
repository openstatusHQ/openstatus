import { AppSidebar } from "@/components/nav/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { auth } from "@/lib/auth";
import { TRPCReactProvider } from "@/lib/trpc/client";
import { HydrateClient, getQueryClient, trpc } from "@/lib/trpc/server";
import { SessionProvider } from "next-auth/react";
import { cookies } from "next/headers";

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const cookieStore = await cookies();
  const hasState = cookieStore.has("sidebar_state");
  const defaultOpen = hasState
    ? cookieStore.get("sidebar_state")?.value === "true"
    : true;

  return (
    <SessionProvider session={session}>
      <TRPCReactProvider>
        <HydrateSidebar>
          <SidebarProvider defaultOpen={defaultOpen}>
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
  await queryClient.prefetchQuery(trpc.user.get.queryOptions());

  return <HydrateClient>{children}</HydrateClient>;
}
