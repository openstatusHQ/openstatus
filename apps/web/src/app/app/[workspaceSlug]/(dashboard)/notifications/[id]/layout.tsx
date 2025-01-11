import { notFound } from "next/navigation";

import { Header } from "@/components/dashboard/header";
import AppPageWithSidebarLayout from "@/components/layout/app-page-with-sidebar-layout";
import { api } from "@/trpc/server";

export default async function Layout(props: {
  children: React.ReactNode;
  params: Promise<{ workspaceSlug: string; id: string }>;
}) {
  const params = await props.params;

  const { children } = props;

  const id = params.id;

  const notification = await api.notification.getNotificationById.query({
    id: Number(id),
  });

  if (!notification) {
    return notFound();
  }

  return (
    <AppPageWithSidebarLayout id="notifications">
      <Header
        title={notification.name}
        description={<span className="font-mono">{notification.provider}</span>}
      />
      {children}
    </AppPageWithSidebarLayout>
  );
}
