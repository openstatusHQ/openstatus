import {
  AppHeader,
  AppHeaderActions,
  AppHeaderContent,
} from "@/components/nav/app-header";
import { AppSidebarTrigger } from "@/components/nav/app-sidebar";
import { HydrateClient, batchPrefetch, trpc } from "@/lib/trpc/server";

import { Tabs } from "../tabs";
import { Breadcrumb } from "./breadcrumb";
import { NavActions } from "./nav-actions";

export default function Layout({ children }: { children: React.ReactNode }) {
  batchPrefetch([
    trpc.member.list.queryOptions(),
    trpc.invitation.list.queryOptions(),
    trpc.apiKey.list.queryOptions(),
  ]);

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
        <Tabs />
        <main className="w-full flex-1">{children}</main>
      </div>
    </HydrateClient>
  );
}
