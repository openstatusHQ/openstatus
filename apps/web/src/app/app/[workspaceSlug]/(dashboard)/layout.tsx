import { InfoAlertDialog } from "@/components/dashboard/info-alert-dialog";
import { AppHeader } from "@/components/layout/header/app-header";
import { api } from "@/trpc/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { WorkspaceClientCookie } from "../worskpace-client-cookie";

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
        description={
          <>
            Each report is now saved within a{" "}
            <span className="font-semibold text-foreground">Status Page</span>.
            Select a page to view all reports for related to it.{" "}
            <Link
              href="/changelog/status-report-location-change"
              className="underline underline-offset-4 hover:text-primary hover:no-underline"
            >
              Read changelog
            </Link>
            .
          </>
        }
        workspaceSlug={workspaceSlug}
      />
    </div>
  );
}
