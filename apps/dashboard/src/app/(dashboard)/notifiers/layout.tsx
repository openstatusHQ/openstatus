import {
  AppHeader,
  AppHeaderActions,
  AppHeaderContent,
} from "@/components/nav/app-header";
import { AppSidebarTrigger } from "@/components/nav/app-sidebar";
import { NavBreadcrumb } from "@/components/nav/nav-breadcrumb";
import { getQueryClient, HydrateClient, trpc } from "@/lib/trpc/server";
import { NavActions } from "./nav-actions";

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const queryClient = getQueryClient();
  await queryClient.prefetchQuery(trpc.notification.list.queryOptions());
  return (
    <HydrateClient>
      <AppHeader>
        <AppHeaderContent>
          <AppSidebarTrigger />
          <NavBreadcrumb items={[{ type: "page", label: "Notifiers" }]} />
        </AppHeaderContent>
        <AppHeaderActions>
          <NavActions />
        </AppHeaderActions>
      </AppHeader>
      <main className="w-full flex-1">{children}</main>
    </HydrateClient>
  );
}
