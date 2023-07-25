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
  params: { workspaceSlug: string };
}) {
  const pages = await api.page.getPagesByWorkspace.query({
    workspaceSlug: params.workspaceSlug,
  });
  const monitors = await api.monitor.getMonitorsByWorkspace.query({
    workspaceSlug: params.workspaceSlug,
  });

  return (
    <div className="grid gap-6 md:grid-cols-2 md:gap-8">
      <Header
        title="Status Page"
        description="Overview of all your status page."
      >
        <CreateForm
          workspaceSlug={params.workspaceSlug}
          allMonitors={monitors}
          disabled={!Boolean(monitors)}
        />
      </Header>
      {Boolean(pages?.length) ? (
        pages?.map((page, index) => (
          <Container
            key={index}
            title={page.title}
            description={page.description}
          >
            <ActionButton
              page={{
                ...page,
                workspaceSlug: params.workspaceSlug,
                monitors: page.monitorsToPages.map(({ monitor }) => monitor.id),
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
        <EmptyState workspaceId={params.workspaceSlug} allMonitors={monitors} />
      )}
    </div>
  );
}
