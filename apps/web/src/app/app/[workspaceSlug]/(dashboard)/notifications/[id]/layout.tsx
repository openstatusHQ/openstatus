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

  const notification = await api.notification.getNotificationById.query({
    id: Number(id),
  });

  if (!notification) {
    return notFound();
  }

  return (
    <AppPageWithSidebarLayout id="notifications">
      <Header title={notification.name} description={notification.provider} />
      {children}
    </AppPageWithSidebarLayout>
  );
}
