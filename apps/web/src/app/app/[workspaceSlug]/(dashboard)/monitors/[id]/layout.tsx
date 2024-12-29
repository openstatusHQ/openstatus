import { notFound } from "next/navigation";

import { Badge } from "@openstatus/ui/src/components/badge";

import { Header } from "@/components/dashboard/header";
import AppPageWithSidebarLayout from "@/components/layout/app-page-with-sidebar-layout";
import { JobTypeIconWithTooltip } from "@/components/monitor/job-type-icon-with-tooltip";
import { NotificationIconWithTooltip } from "@/components/monitor/notification-icon-with-tooltip";
import { StatusDotWithTooltip } from "@/components/monitor/status-dot-with-tooltip";
import { TagBadgeWithTooltip } from "@/components/monitor/tag-badge-with-tooltip";
import { api } from "@/trpc/server";

export const revalidate = 0; // revalidate the data at most every hour
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default async function Layout(props: {
  children: React.ReactNode;
  params: Promise<{ workspaceSlug: string; id: string }>;
}) {
  const params = await props.params;

  const { children } = props;

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
            <a
              href={monitor.url}
              target="_blank"
              rel="noreferrer"
              className="max-w-xs truncate text-base text-muted-foreground md:max-w-md"
            >
              {monitor.url}
            </a>
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
                    ({ monitorTag }) => monitorTag,
                  )}
                />
              </>
            ) : null}
            <span className="text-muted-foreground/50 text-xs">•</span>
            <span className="text-sm">
              every <code>{monitor.periodicity}</code>
            </span>
            <span className="text-muted-foreground/50 text-xs">•</span>
            <JobTypeIconWithTooltip jobType={monitor.jobType} />
            {monitor.public ? (
              <>
                <span className="text-muted-foreground/50 text-xs">•</span>
                <Badge variant="secondary">public</Badge>
              </>
            ) : null}
            <span className="text-muted-foreground/50 text-xs">•</span>
            <NotificationIconWithTooltip
              notifications={monitor.monitorsToNotifications.map(
                ({ notification }) => notification,
              )}
            />
          </div>
        }
      />
      {children}
    </AppPageWithSidebarLayout>
  );
}
