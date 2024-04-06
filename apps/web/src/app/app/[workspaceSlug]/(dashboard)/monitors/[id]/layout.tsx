import { notFound } from "next/navigation";

import { Header } from "@/components/dashboard/header";
import AppPageWithSidebarLayout from "@/components/layout/app-page-with-sidebar-layout";
import { StatusDotWithTooltip } from "@/components/monitor/status-dot-with-tooltip";
import { TagBadgeWithTooltip } from "@/components/monitor/tag-badge-with-tooltip";
import { api } from "@/trpc/server";

export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { workspaceSlug: string; id: string };
}) {
  const id = params.id;

  const monitor = await api.monitor.getMonitorById.query({
    id: Number(id),
  });

  if (!monitor) {
    return notFound();
  }

  return (
    <AppPageWithSidebarLayout id="monitors">
      <Header
        title={monitor.name}
        description={
          <div className="text-muted-foreground flex flex-wrap items-center gap-2">
            <span className="max-w-xs truncate md:max-w-md">{monitor.url}</span>
            <span className="text-muted-foreground/50 text-xs">•</span>
            <StatusDotWithTooltip
              active={monitor.active}
              status={monitor.status}
            />
            <span className="text-muted-foreground/50 text-xs">•</span>
            <TagBadgeWithTooltip
              tags={monitor.monitorTagsToMonitors.map(
                ({ monitorTag }) => monitorTag,
              )}
            />
            <span className="text-muted-foreground/50 text-xs">•</span>
            <span className="text-sm">
              every <code>{monitor.periodicity}</code>
            </span>
          </div>
        }
      />
      {children}
    </AppPageWithSidebarLayout>
  );
}
