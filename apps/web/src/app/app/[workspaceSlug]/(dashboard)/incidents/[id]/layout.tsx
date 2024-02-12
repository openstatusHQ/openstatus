import { notFound } from "next/navigation";

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

  const monitor = await api.incident.getIncidentById.query({
    id: Number(id),
  });

  if (!monitor) {
    return notFound();
  }

  return (
    <AppPageWithSidebarLayout id="incidents">
      {children}
    </AppPageWithSidebarLayout>
  );
}
