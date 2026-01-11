import { redirect } from "next/navigation";

import {
  AppHeader,
  AppHeaderActions,
  AppHeaderContent,
} from "@/components/nav/app-header";
import { AppSidebarTrigger } from "@/components/nav/app-sidebar";

import { HydrateClient, getQueryClient, trpc } from "@/lib/trpc/server";
import { Breadcrumb } from "./breadcrumb";
import { NavActions } from "./nav-actions";

export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const queryClient = getQueryClient();

  try {
    const pageData = await queryClient.fetchQuery(
      trpc.page.get.queryOptions({ id: Number.parseInt(id) }),
    );

    // Redirect to status-pages list if page doesn't exist or user doesn't have access
    if (!pageData?.id) {
      redirect("/status-pages");
    }
  } catch {
    // Redirect if fetching page fails (e.g., user doesn't have access)
    redirect("/status-pages");
  }

  await queryClient.prefetchQuery(trpc.monitor.list.queryOptions());

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
        <main className="flex-1">{children}</main>
      </div>
    </HydrateClient>
  );
}
