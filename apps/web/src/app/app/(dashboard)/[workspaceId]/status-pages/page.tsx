import * as React from "react";

import { Container } from "@/components/dashboard/container";
import { Header } from "@/components/dashboard/header";
import { api } from "@/trpc/server";
import { ActionButton } from "./_components/action-button";
import { CreateForm } from "./_components/create-form";
import { EmptyState } from "./_components/empty-state";

export default async function Page({
  params,
}: {
  params: { workspaceId: string };
}) {
  const workspaceId = Number(params.workspaceId);
  const pages = await api.page.getPagesByWorkspace.query({
    workspaceId,
  });
  const monitors = await api.monitor.getMonitorsByWorkspace.query({
    workspaceId,
  });

  return (
    <div className="grid gap-6 md:grid-cols-2 md:gap-8">
      <Header
        title="Status Page"
        description="Overview of all your status page."
      >
        <CreateForm
          workspaceId={workspaceId}
          allMonitors={monitors}
          disabled={!Boolean(monitors)}
        />
      </Header>
      {Boolean(pages.length) ? (
        pages.map((page, index) => (
          <Container
            key={index}
            title={page.title}
            description={page.description}
          >
            <ActionButton
              page={{
                ...page,
                // FIXME: how to automatically make the { monitor: number[] }
                monitors: page.monitors.map(({ monitorId }) => monitorId),
              }}
              allMonitors={monitors}
            />
            <dl className="[&_dt]:text-muted-foreground grid gap-2 [&>*]:text-sm [&_dt]:font-light">
              <div className="flex min-w-0 items-center justify-between gap-3">
                <dt>Slug</dt>
                <dd className="font-mono">{page.slug}</dd>
              </div>
            </dl>
          </Container>
        ))
      ) : (
        <EmptyState workspaceId={workspaceId} allMonitors={monitors} />
      )}
    </div>
  );
}
