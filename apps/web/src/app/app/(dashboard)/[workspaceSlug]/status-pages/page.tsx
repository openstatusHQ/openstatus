import * as React from "react";
import Link from "next/link";

import { allPlans } from "@openstatus/plans";

import { Container } from "@/components/dashboard/container";
import { Header } from "@/components/dashboard/header";
import { Limit } from "@/components/dashboard/limit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonWithDisableTooltip } from "@/components/ui/button-with-disable-tooltip";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/server";
import { ActionButton } from "./_components/action-button";
import { EmptyState } from "./_components/empty-state";

// export const revalidate = 0;
export const dynamic = "force-dynamic";

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

  const workspace = await api.workspace.getWorkspace.query({
    slug: params.workspaceSlug,
  });

  const isLimit =
    (pages?.length || 0) >=
    allPlans[workspace?.plan || "free"].limits["status-pages"];

  const disableButton = isLimit || !Boolean(monitors);

  return (
    <div className="grid gap-6 md:grid-cols-2 md:gap-8">
      <Header
        title="Status Page"
        description="Overview of all your status pages."
        actions={
          <ButtonWithDisableTooltip
            tooltip="You reached the limits"
            asChild={!disableButton}
            disabled={disableButton}
          >
            <Link href="./status-pages/edit">Create</Link>
          </ButtonWithDisableTooltip>
        }
      />
      {Boolean(pages?.length) ? (
        pages?.map((page, index) => (
          <Container
            key={index}
            title={page.title}
            description={page.description}
            actions={
              <ActionButton
                page={{
                  ...page,
                  workspaceSlug: params.workspaceSlug,
                  monitors: page.monitorsToPages.map(
                    ({ monitor }) => monitor.id,
                  ),
                }}
              />
            }
          >
            <dl className="[&_dt]:text-muted-foreground grid gap-2 [&>*]:text-sm [&_dt]:font-light">
              <div className="flex min-w-0 items-center justify-between gap-3">
                <dt>Slug</dt>
                <dd className="font-mono">{page.slug}</dd>
              </div>
              <div className="flex min-w-0 items-center justify-between gap-3">
                <dt>Monitors</dt>
                <dd className="flex flex-wrap justify-end gap-2">
                  {page.monitorsToPages.map(
                    ({ monitor: { id, name, active } }) => (
                      <Link key={id} href={`./monitors/edit?id=${id}`}>
                        <Badge variant={active ? "default" : "outline"}>
                          {name}
                          <span
                            className={cn(
                              "ml-1 inline-block h-1.5 w-1.5 rounded-full",
                              active ? "bg-green-500" : "bg-red-500",
                            )}
                          />
                        </Badge>
                      </Link>
                    ),
                  )}
                </dd>
              </div>
            </dl>
          </Container>
        ))
      ) : (
        <EmptyState allMonitors={monitors} />
      )}
      {isLimit ? <Limit /> : null}
    </div>
  );
}
