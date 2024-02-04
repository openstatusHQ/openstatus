import { notFound } from "next/navigation";

import { Header } from "@/components/dashboard/header";
import { Navbar } from "@/components/dashboard/navbar";
import { api } from "@/trpc/server";

export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { workspaceSlug: string; id: string };
}) {
  const id = params.id;

  const monitor = await api.monitor.getMonitorById.query({
    id: Number(id),
  });

  if (!monitor) {
    return notFound();
  }

  const navigation = [
    {
      label: "Overview",
      href: `/app/${params.workspaceSlug}/monitors/${id}/overview`,
      segment: "overview",
    },
    {
      label: "Requests Log",
      href: `/app/${params.workspaceSlug}/monitors/${id}/data`,
      segment: "data",
    },
    {
      label: "Settings",
      href: `/app/${params.workspaceSlug}/monitors/${id}/edit`,
      segment: "edit",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-6 md:gap-8">
      <Header title={monitor.name} description={monitor.url} />
      <Navbar className="col-span-full" navigation={navigation} />
      {children}
    </div>
  );
}
