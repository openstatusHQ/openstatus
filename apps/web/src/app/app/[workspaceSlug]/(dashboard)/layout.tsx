import { AppHeader } from "@/components/layout/header/app-header";
import { api } from "@/trpc/server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { WorkspaceClientCookie } from "../worskpace-client-cookie";
import { InfoAlertDialog } from "@/components/dashboard/info-alert-dialog";

// TODO: make the container min-h-screen and the footer below!
export default async function AppLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: { workspaceSlug: string };
}) {
  const { workspaceSlug } = params;
  const workspaces = await api.workspace.getUserWorkspaces.query();

  if (workspaces.length === 0) return notFound();
  if (workspaces.find((w) => w.slug === workspaceSlug) === undefined)
    return notFound();

  return (
    <div className="container relative mx-auto flex min-h-screen w-full flex-col items-center justify-center gap-6 p-4">
      <AppHeader />
      <main className="z-10 flex w-full flex-1 flex-col items-start justify-center">
        {children}
      </main>
      <WorkspaceClientCookie {...{ workspaceSlug }} />
      <InfoAlertDialog
        id="status-report-location-change"
        title="An update on Status Reports"
        expires={365} // 1 year - TODO: delete the block after 30 days
        description="Each status report is now saved within a Status Page. You can find them by selecting the appropriate page."
        workspaceSlug={workspaceSlug}
      />
    </div>
  );
}
