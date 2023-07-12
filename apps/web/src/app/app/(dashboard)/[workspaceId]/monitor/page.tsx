import * as React from "react";

import { Container } from "@/components/dashboard/container";
import { Header } from "@/components/dashboard/header";
import { api } from "@/trpc/server";

export default async function MonitorPage({
  params,
}: {
  params: { workspaceId: string };
}) {
  const monitors = await api.monitor.getMonitorsByWorkspace.query({
    workspaceId: Number(params.workspaceId),
  });
  console.log(monitors);
  // iterate over monitors
  return (
    <div className="grid gap-6 md:grid-cols-2 md:gap-8">
      <Header title="Monitor" description="Overview of all the responses." />
      <Container title="Hello"></Container>
      <Container title="World"></Container>
    </div>
  );
}
