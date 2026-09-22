"use client";

import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "@/lib/trpc/client";

export function useCommandMenuData({ open }: { open: boolean }) {
  const trpc = useTRPC();

  // `enabled: open` keeps the always-mounted palette from fetching on every
  // dashboard load; data stays cached once fetched.
  const { data: monitors } = useQuery(
    trpc.monitor.list.queryOptions(undefined, { enabled: open }),
  );
  const { data: statusPages } = useQuery(
    trpc.page.list.queryOptions(undefined, { enabled: open }),
  );
  const { data: workspaces } = useQuery(
    trpc.workspace.list.queryOptions(undefined, { enabled: open }),
  );
  const { data: workspace } = useQuery(
    trpc.workspace.get.queryOptions(undefined, { enabled: open }),
  );
  // Inputs match the overview/create-sheet queries so create mutations
  // invalidate this cache entry too.
  const { data: statusReports } = useQuery(
    trpc.statusReport.list.queryOptions({}, { enabled: open }),
  );
  const { data: maintenances } = useQuery(
    trpc.maintenance.list.queryOptions(undefined, { enabled: open }),
  );

  const otherWorkspaces =
    workspaces?.filter((w) => w.slug !== workspace?.slug) ?? [];

  // Unresolved reports first; within each partition keep server order (desc).
  const sortedStatusReports = statusReports
    ? [
        ...statusReports.filter((r) => r.status !== "resolved"),
        ...statusReports.filter((r) => r.status === "resolved"),
      ]
    : undefined;

  // Upcoming/active maintenances first, then past (server order desc).
  // Orphans without a page are skipped — no route to navigate to.
  const now = Date.now();
  const withPage = maintenances?.filter((m) => m.pageId !== null);
  const sortedMaintenances = withPage
    ? [
        ...withPage.filter((m) => m.to.getTime() >= now),
        ...withPage.filter((m) => m.to.getTime() < now),
      ]
    : undefined;

  const pageTitleById = new Map(statusPages?.map((p) => [p.id, p.title]) ?? []);

  return {
    monitors,
    statusPages,
    statusReports,
    sortedStatusReports,
    sortedMaintenances,
    otherWorkspaces,
    pageTitleById,
  };
}
