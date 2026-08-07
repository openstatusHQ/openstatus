import {
  AppHeader,
  AppHeaderActions,
  AppHeaderContent,
} from "@/components/nav/app-header";
import { AppSidebarTrigger } from "@/components/nav/app-sidebar";
import { HydrateClient } from "@/lib/trpc/server";

import { Breadcrumb } from "./breadcrumb";
import { NavActions } from "./nav-actions";

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <HydrateClient>
      <AppHeader>
        <AppHeaderContent>
          <AppSidebarTrigger />
          <Breadcrumb />
        </AppHeaderContent>
        <AppHeaderActions>
          <NavActions />
        </AppHeaderActions>
      </AppHeader>
      <main className="w-full flex-1">{children}</main>
    </HydrateClient>
  );
}
