import * as React from "react";
import Link from "next/link";

import { allPlans } from "@openstatus/plans";
import { Badge } from "@openstatus/ui/src/components/badge";
import { ButtonWithDisableTooltip } from "@openstatus/ui/src/components/button-with-disable-tooltip";

import { Container } from "@/components/dashboard/container";
import { Header } from "@/components/dashboard/header";
import { Limit } from "@/components/dashboard/limit";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/server";
import { ActionButton } from "./_components/action-button";
import { EmptyState } from "./_components/empty-state";

export default async function MonitorPage({
  params,
}: {
  params: { workspaceSlug: string };
}) {
  const monitors = await api.monitor.getMonitorsByWorkspace.query({
    workspaceSlug: params.workspaceSlug,
  });
  const workspace = await api.workspace.getWorkspace.query({
    slug: params.workspaceSlug,
  });

  const isLimit =
    (monitors?.length || 0) >=
    allPlans[workspace?.plan || "free"].limits.monitors;

  return (
    <div className="grid gap-6 md:grid-cols-2 md:gap-8">
      <Header
        title="Monitors"
        description="Overview of all your monitors."
        actions={
          <ButtonWithDisableTooltip
            tooltip="You reached the limits"
            asChild={!isLimit}
            disabled={isLimit}
          >
            <Link href="./monitors/edit">Create</Link>
          </ButtonWithDisableTooltip>
        }
      />
      {Boolean(monitors?.length) ? (
        monitors?.map((monitor, index) => (
          <Container
            key={index}
            title={monitor.name}
            description={monitor.description}
            actions={[
              <Badge
                key="status-badge"
                variant={monitor.active ? "default" : "outline"}
                className="capitalize"
              >
                {monitor.active ? "active" : "inactive"}
                <span
                  className={cn(
                    "ml-1 h-1.5 w-1.5 rounded-full",
                    monitor.active ? "bg-green-500" : "bg-red-500",
                  )}
                />
              </Badge>,
              <ActionButton
                key="action-button"
                {...monitor}
                workspaceSlug={params.workspaceSlug}
              />,
            ]}
          >
            <dl className="[&_dt]:text-muted-foreground grid gap-2 [&>*]:text-sm [&_dt]:font-light">
              <div className="flex min-w-0 items-center justify-between gap-3">
                <dt>Frequency</dt>
                <dd className="font-mono">{monitor.periodicity}</dd>
              </div>
              <div className="flex min-w-0 items-center justify-between gap-3">
                <dt>URL</dt>
                <dd className="overflow-hidden text-ellipsis font-semibold">
                  {monitor.url}
                </dd>
              </div>
              <div className="flex min-w-0 items-center justify-between gap-3">
                <dt>Method</dt>
                <dd className="overflow-hidden text-ellipsis font-semibold">
                  <Badge
                    variant="outline"
                    className={cn(
                      "font-mono",
                      monitor.method === "GET"
                        ? "border-blue-100 bg-blue-50 text-blue-600"
                        : "border-amber-100 bg-amber-50 text-amber-600",
                    )}
                  >
                    {monitor.method}
                  </Badge>
                </dd>
              </div>
            </dl>
          </Container>
        ))
      ) : (
        <EmptyState />
      )}
      {isLimit ? <Limit /> : null}
    </div>
  );
}
