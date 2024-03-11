import { notFound } from "next/navigation";

import { Badge } from "@openstatus/ui";

import { Header } from "@/components/dashboard/header";
import AppPageWithSidebarLayout from "@/components/layout/app-page-with-sidebar-layout";
import { StatusDotWithTooltip } from "@/components/monitor/status-dot-with-tooltip";
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
          <div className="text-muted-foreground flex items-center gap-2">
            <span>{monitor.url}</span>
            <span className="text-muted-foreground/50 text-xs">•</span>
            <StatusDotWithTooltip
              active={monitor.active}
              status={monitor.status}
            />
            <span className="text-muted-foreground/50 text-xs">•</span>
            <Badge className="inline-flex" variant="secondary">
              {monitor.method}
            </Badge>
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
