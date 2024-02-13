import * as React from "react";
import { notFound } from "next/navigation";

import { AppHeader } from "@/components/layout/header/app-header";
import { api } from "@/trpc/server";
import { WorkspaceClientCookie } from "../worskpace-client-cookie";

// TODO: make the container min-h-screen and the footer below!
export default async function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
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
    </div>
  );
}
