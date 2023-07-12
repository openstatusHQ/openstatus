import * as React from "react";

import { Container } from "@/components/dashboard/container";
import { Header } from "@/components/dashboard/header";
import { MonitorCreateForm } from "@/components/forms/montitor-form";
import { api } from "@/trpc/server";

export default async function MonitorPage({
  params,
}: {
  params: { workspaceId: string };
}) {
  const monitors = await api.monitor.getMonitorsByWorkspace.query({
    workspaceId: Number(params.workspaceId),
  });
  // iterate over monitors
  return (
    <div className="grid gap-6 md:grid-cols-2 md:gap-8">
      <Header title="Monitors" description="Overview of all your monitors.">
        <MonitorCreateForm />
      </Header>
      {monitors.map((monitor) => (
        <>
          <Container title={monitor.url} description={monitor.name}></Container>
        </>
      ))}
    </div>
  );
}
