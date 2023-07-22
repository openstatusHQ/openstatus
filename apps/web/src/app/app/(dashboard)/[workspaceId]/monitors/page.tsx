import * as React from "react";

import { Container } from "@/components/dashboard/container";
import { Header } from "@/components/dashboard/header";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/server";
import { ActionButton } from "./_components/action-button";
import { CreateForm } from "./_components/create-form";
import { EmptyState } from "./_components/empty-state";

export default async function MonitorPage({
  params,
}: {
  params: { workspaceId: string };
}) {
  const workspaceId = Number(params.workspaceId);
  const monitors = await api.monitor.getMonitorsByWorkspace.query({
    workspaceId,
  });

  return (
    <div className="grid gap-6 md:grid-cols-2 md:gap-8">
      <Header title="Monitors" description="Overview of all your monitors.">
        <CreateForm {...{ workspaceId }} />
      </Header>
      {Boolean(monitors.length) ? (
        monitors.map((monitor, index) => (
          <Container
            key={index}
            title={monitor.name}
            description={monitor.description}
          >
            <ActionButton {...monitor} />
            <dl className="[&_dt]:text-muted-foreground grid gap-2 [&>*]:text-sm [&_dt]:font-light">
              <div className="flex min-w-0 items-center justify-between gap-3">
                <dt>Status</dt>
                <dd>
                  <Badge
                    variant={
                      monitor.status === "active" ? "default" : "outline"
                    }
                    className="capitalize"
                  >
                    {monitor.status}
                    <span
                      className={cn(
                        "ml-1 h-1.5 w-1.5 rounded-full",
                        monitor.status === "active"
                          ? "bg-green-500"
                          : "bg-red-500",
                      )}
                    />
                  </Badge>
                </dd>
              </div>
              <div className="flex min-w-0 items-center justify-between gap-3">
                <dt>Periodicity</dt>
                <dd className="font-mono">{monitor.periodicity}</dd>
              </div>
              <div className="flex min-w-0 items-center justify-between gap-3">
                <dt>URL</dt>
                <dd className="overflow-hidden text-ellipsis font-semibold">
                  {monitor.url}
                </dd>
              </div>
            </dl>
          </Container>
        ))
      ) : (
        <EmptyState {...{ workspaceId }} />
      )}
    </div>
  );
}
