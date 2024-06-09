import { notFound } from "next/navigation";

import { Badge } from "@openstatus/ui";

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
          <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
            <span className="max-w-xs truncate md:max-w-md">{monitor.url}</span>
            <span className="text-muted-foreground/50 text-xs">•</span>
            <StatusDotWithTooltip
              active={monitor.active}
              status={monitor.status}
              maintenance={monitor.maintenance}
            />
            {monitor.monitorTagsToMonitors.length > 0 ? (
              <>
                <span className="text-muted-foreground/50 text-xs">•</span>
                <TagBadgeWithTooltip
                  tags={monitor.monitorTagsToMonitors.map(
                    ({ monitorTag }) => monitorTag
                  )}
                />
              </>
            ) : null}
            <span className="text-muted-foreground/50 text-xs">•</span>
            <span className="text-sm">
              every <code>{monitor.periodicity}</code>
            </span>
            {monitor.public ? (
              <>
                <span className="text-muted-foreground/50 text-xs">•</span>
                <Badge variant="secondary">public</Badge>
              </>
            ) : null}
          </div>
        }
      />
      {children}
    </AppPageWithSidebarLayout>
  );
}
