import {
  SidebarInset,
  SidebarProvider,
} from "@openstatus/ui/components/ui/sidebar";
import { cookies } from "next/headers";

import { CommandMenu } from "@/components/command-menu/command-menu";
import { CommandMenuProvider } from "@/components/command-menu/provider";
import { DismissedNotesProvider } from "@/components/common/note-dismissible";
import { AppSidebar } from "@/components/nav/app-sidebar";
import {
  LEFT_SIDEBAR_COOKIE,
  getSidebarDefaultOpen,
} from "@/lib/sidebar-cookie";
import { HydrateClient, batchPrefetch, trpc } from "@/lib/trpc/server";

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const defaultOpen = await getSidebarDefaultOpen(LEFT_SIDEBAR_COOKIE, true);
  const cookieStore = await cookies();
  const dismissedNotes = cookieStore
    .getAll()
    .filter((c) => c.name.startsWith("note_") && c.value === "false")
    .map((c) => c.name);

  return (
    <DismissedNotesProvider dismissed={dismissedNotes}>
      <HydrateSidebar>
        <SidebarProvider
          defaultOpen={defaultOpen}
          cookieName={LEFT_SIDEBAR_COOKIE}
        >
          <CommandMenuProvider>
            <AppSidebar />
            <CommandMenu />
            <SidebarInset>{children}</SidebarInset>
          </CommandMenuProvider>
        </SidebarProvider>
      </HydrateSidebar>
    </DismissedNotesProvider>
  );
}

function HydrateSidebar({ children }: { children: React.ReactNode }) {
  batchPrefetch([
    trpc.page.list.queryOptions(),
    trpc.monitor.list.queryOptions(),
    trpc.workspace.get.queryOptions(),
    trpc.workspace.list.queryOptions(),
    trpc.user.get.queryOptions(),
  ]);

  return <HydrateClient>{children}</HydrateClient>;
}
