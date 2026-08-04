import {
  AppHeader,
  AppHeaderActions,
  AppHeaderContent,
} from "@/components/nav/app-header";
import { AppSidebarTrigger } from "@/components/nav/app-sidebar";
import { overviewActiveOrClosedSince } from "@/data/overview-window";
import { HydrateClient, batchPrefetch, trpc } from "@/lib/trpc/server";

import { Breadcrumb } from "./breadcrumb";
import { NavActions } from "./nav-actions";

export default function Layout({ children }: { children: React.ReactNode }) {
  const activeOrClosedSince = overviewActiveOrClosedSince();

  // inputs must match page.tsx's queries exactly — a differing input misses the cache
  batchPrefetch([
    trpc.monitor.list.queryOptions(),
    trpc.page.list.queryOptions(),
    trpc.incident.list.queryOptions({ activeOrClosedSince }),
    trpc.statusReport.list.queryOptions({ activeOrClosedSince }),
    trpc.maintenance.list.queryOptions({ activeOrClosedSince }),
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
        <main className="w-full flex-1">{children}</main>
      </div>
    </HydrateClient>
  );
}
