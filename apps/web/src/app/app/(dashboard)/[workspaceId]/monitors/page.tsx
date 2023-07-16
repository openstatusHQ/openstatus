import * as React from "react";

import { Container } from "@/components/dashboard/container";
import { Header } from "@/components/dashboard/header";
import { api } from "@/trpc/server";
import { ActionButton } from "./_components/action-button";
import { CreateForm } from "./_components/create-form";

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
      {monitors.map((monitor, index) => (
        <Container key={index} title={monitor.name} description={monitor.url}>
          <ActionButton {...monitor} />
        </Container>
      ))}
    </div>
  );
}
