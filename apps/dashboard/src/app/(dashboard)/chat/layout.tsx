import { SidebarProvider } from "@openstatus/ui/components/ui/sidebar";

import { ChatSessionProvider } from "@/components/chat/chat-session-context";
import {
  AppHeader,
  AppHeaderActions,
  AppHeaderContent,
} from "@/components/nav/app-header";
import { AppSidebarTrigger } from "@/components/nav/app-sidebar";
import { HydrateClient, getQueryClient, trpc } from "@/lib/trpc/server";

import { Breadcrumb } from "./breadcrumb";
import { NavActions } from "./nav-actions";
import { Sidebar } from "./sidebar";

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Prefetch the conversation list so the right sidebar paints immediately.
  const queryClient = getQueryClient();
  await queryClient.prefetchQuery(trpc.chatSession.list.queryOptions());

  return (
    <HydrateClient>
      <ChatSessionProvider>
        <AppHeader>
          <AppHeaderContent>
            <AppSidebarTrigger />
            <Breadcrumb />
          </AppHeaderContent>
          <AppHeaderActions>
            <NavActions />
          </AppHeaderActions>
        </AppHeader>
        <SidebarProvider defaultOpen={false}>
          <main className="w-full flex-1">{children}</main>
          <div className="hidden lg:block">
            <Sidebar />
          </div>
        </SidebarProvider>
      </ChatSessionProvider>
    </HydrateClient>
  );
}
