import { notFound } from "next/navigation";

import { Header } from "@/components/dashboard/header";
import AppPageWithSidebarLayout from "@/components/layout/app-page-with-sidebar-layout";
import { api } from "@/trpc/server";
import { StatusUpdateButton } from "./_components/status-update-button";

export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { workspaceSlug: string; id: string };
}) {
  const id = params.id;

  const statusReport = await api.statusReport.getStatusReportById.query({
    id: Number(id),
  });

  if (!statusReport) {
    return notFound();
  }

  return (
    <AppPageWithSidebarLayout id="status-reports">
      <Header
        title={statusReport.title}
        actions={<StatusUpdateButton statusReportId={Number(id)} />}
      />
      {children}
    </AppPageWithSidebarLayout>
  );
}
