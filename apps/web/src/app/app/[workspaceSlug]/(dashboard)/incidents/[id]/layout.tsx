import { notFound } from "next/navigation";

import { Header } from "@/components/dashboard/header";
import AppPageWithSidebarLayout from "@/components/layout/app-page-with-sidebar-layout";
import { api } from "@/trpc/server";

export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { workspaceSlug: string; id: string };
}) {
  const id = params.id;

  const [incidents, incident] = await Promise.all([
    api.incident.getIncidentsByWorkspace.query(),
    api.incident.getIncidentById.query({
      id: Number(id),
    }),
  ]);

  if (!incident) {
    return notFound();
  }

  const incidentIndex = incidents.findIndex((item) => item.id === incident.id);

  return (
    <AppPageWithSidebarLayout id="incidents">
      <Header title={`Incident #${incidentIndex + 1}`} />
      {children}
    </AppPageWithSidebarLayout>
  );
}
