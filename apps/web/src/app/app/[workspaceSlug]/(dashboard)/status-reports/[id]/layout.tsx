import { notFound } from "next/navigation";

import { Header } from "@/components/dashboard/header";
import { Navbar } from "@/components/dashboard/navbar";
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

  const navigation = [
    {
      label: "Overview",
      href: `/app/${params.workspaceSlug}/status-reports/${id}/overview`,
      segment: "overview",
    },
    {
      label: "Settings",
      href: `/app/${params.workspaceSlug}/status-reports/${id}/edit`,
      segment: "edit",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-6 md:gap-8">
      <Header title={statusReport.title} actions={<StatusUpdateButton />} />
      <Navbar className="col-span-full" navigation={navigation} />
      {children}
    </div>
  );
}
