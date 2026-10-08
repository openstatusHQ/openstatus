import { SidebarProvider } from "@openstatus/ui/components/ui/sidebar";

import {
  RIGHT_SIDEBAR_COOKIE,
  getSidebarDefaultOpen,
} from "@/lib/sidebar-cookie";
import { HydrateClient } from "@/lib/trpc/server";

import { Sidebar } from "../sidebar";

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
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
